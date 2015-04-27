
(function () {
	"use strict";

	// Extend the jquery library to scroll the caller(s) to the given element
	jQuery.fn.scrollTo = function (elem, speed) {
		// If this is a collection recursively call it on its children
		if (this.length > 1) {
			for (var i = 0; i < this.length; i++) {
				$(this[i]).scrollTo(elem, speed);
			}
			return;
		}
		if (speed === undefined || speed <= 0) {
			// Non-Animated
			$(this).scrollTop($(this).scrollTop() - $(this).offset().top + $(elem).offset().top); 
		}
		else {
			// Animated
			$(this).animate({
				scrollTop:  $(this).scrollTop() - $(this).offset().top + $(elem).offset().top 
			}, speed); 
		}
			
		return this; 
	};


	// Main method, called once on load
	var main = function() {
		
		var timer;
		var lastResponseTime;
		var updateRate = tweetTracker('getUpdateRate')();

		var fetchUpdates = function () {
			console.log("fetch updates called");
			var resource = '/getTweets';
			var data = {};
			/*
			$.each(currentLabels, function(index, value) {
				data['label'+index] = value;
			});
			*/
			var timeSinceLast = new Date().getTime() - lastResponseTime;
			// if we haven't waited enough time set a new timeout and return
			if (timeSinceLast < updateRate) {
				timer = setTimeout(fetchUpdates, updateRate-timeSinceLast);
				return;
			}
			$.get(resource, data, function (responseObject) {
				console.log(responseObject);
				//var responseObject = JSON.parse(reply);
				console.log(responseObject);
				var counts = responseObject.counts;
				tweetTracker('updateCounts')(counts);
				var tweets = responseObject.tweets;
				tweetTracker('updateTweets')(tweets);
				lastResponseTime = new Date().getTime();
				timer = setTimeout(fetchUpdates, updateRate);
			});
		};

		var currentLabels = [];

		$.get('/getFilters', {}, function (responseObject) {
			//var responseObject = JSON.parse(reply);
			tweetTracker('addFilters')(responseObject);
		});

		$('#start-tracking').on('click', function () {
			$('#stop-tracking').prop('disabled', false);
			$(this).prop('disabled', true);

			fetchUpdates();
		});
		$('#stop-tracking').on('click', function () {
			clearTimeout(timer);
			$('#start-tracking').prop('disabled', false);
			$(this).prop('disabled', true);
		});

		fetchUpdates();
		$('#start-tracking').prop('disabled', true);
		
	};

	$(document).ready(function() {
		main();
	});
}());

/**
* Tweet tracker holds a list of tweet filters
* Filters can be reset, added, updated, and their labels can be fetched using the messages
* resetFilters, addFilter, update, and getLabels
*/
var tweetTracker = (function() {
	"use strict";
	// Constructor function for a new tweet filter
	var newTweetFilter =  function() {
		// tweet filter ivars
		var label = '';
		var count = 0;
		var tweets = [];
		return function(msg) {
			// set the label for the tweet filter
			if (msg === 'setLabel') {
				return function(value) {
					label = value;
				};
			}
			// get the label for the tweet filter
			if (msg === 'getLabel') {
				return function() {
					return label;
				};
			}
			// get the current count
			if (msg === 'getCount') {
				return function() {
					return count;
				};
			}
			// set the current count
			if (msg === 'setCount') {
				return function(value) {
					if (typeof value == "number") {
						count = value;
					}
				};
			}
			// increment the current count
			if (msg === 'addCount') {
				return function(value) {
					if (typeof value == "number") {
						count += value;
					}
				};
			}
			// Add a tweet
			if (msg === 'addTweet') {
				return function(tweet) {
					tweets.push(tweet);
				};
			}
			// get the current list of tweets
			if (msg === 'getTweets') {
				return function() {
					return tweets.slice();
				}
			}
		};
	};

	// Tweet tracker ivars
	var tweetLabels = [];
	var tweets = [];
	var updateRate = 10000;
	var filterLabel = "";

	return function(msg) {
		// Reset the filters
		if (msg === "resetFilters") {
			tweetLabels = [];
			tweets = [];
			tweetGraph('resetGraph')();
			tweetFeed('clearTweets')();
		}
		// Add a filter
		if (msg === "addFilters") {
			// Prams: label - the label for the filter, 
			return function(labels) {
				for (var i = 0; i < labels.length; i++) {
					// create a new tweet label
					var tl = newTweetFilter()
					tl('setLabel')(labels[i]);// set the label name
					tweetLabels.push(tl);// add it to the list
				}
				tweetGraph('setLabels')(labels);
			};
		}
		// Update Counts Format: [{filter: "label", count : 5}, {...}, ...]
		if (msg === "updateCounts") {
			return function(updates) {
				// for each update
				for (var i = 0; i < updates.length; i++) {
					var update = updates[i];// get the update
					// for each tweet filter
					for (var j = 0; j < tweetLabels.length; j++) {
						// check if the update filter is the same as the tweet filter label
						if (update.filter === tweetLabels[j]('getLabel')()) {
							// update the count
							tweetLabels[j]('addCount')(update.count);
							tweetGraph('updateCount')(update.filter, tweetLabels[j]('getCount')());
						}
					}
				}
			};
		}
		// Update tweets in the format: [{filter: "label", tweet: "Hello, World"}, {...}, ...]
		// The tweets should be in order from oldest to newest
		if (msg === 'updateTweets') {
			return function(tweetList) {
				for (var i = 0; i < tweetList.length; i++) {
					var current = tweetList[i];
					tweets.push(current.tweet);
					if (filterLabel === current.filter || filterLabel === '') {
						tweetFeed('addTweet')(current.tweet);
					}
					for (var j = 0; j < tweetLabels.length; j++) {
						// check if the tweet key is the same as the tweet filter label
						if (current.filter === tweetLabels[j]('getLabel')()) {
							// update the tweet
							tweetLabels[j]('addTweet')(current.tweet);
						}
					}
				}
			}
		}
		// Get an array of all the current labels
		if (msg === "getLabels") {
			return function() {
				var list = [];
				for (var i = 0; i < tweetLabels.length; i++) {
					list.push(tweetLabels("getLabel")());
				}
				return list;
			};
		}
		// get the update rate
		if (msg === 'getUpdateRate') {
			return function() {
				return updateRate;
			};
		}
		// filter tweets based on a given label
		if (msg === 'filterTweets') {
			return function(label) {
				// reset the current tweet list
				tweetFeed('clearTweets')();
				if (!label) {
					// add all tweets (no filter)
					filterLabel = '';
					tweetFeed('addTweets')(tweets);
					$('.selected-filter__label').text('(all)');
				}
				else {
					$('.selected-filter__label').text('(' + label + ')');
					filterLabel = label;
					// find the given label and get its tweets
					for (var i = 0; i < tweetLabels.length; i++) {
						if (label === tweetLabels[i]('getLabel')()) {
							tweetFeed('addTweets')(tweetLabels[i]('getTweets')());
						}
					}
				}
			};
		}
	};

}());


var tweetGraph = (function() {

	var bars = [];
	var $bars = $('.graph__bar');
	var initCount = 10;
	var maxCount = initCount;

	var graphHeight = $('.graph').height();
	var idPrefix = '#graph__bar-';
	var updateRate = Math.floor(tweetTracker('getUpdateRate')() * 0.6);
	var labelRate = updateRate / 2;

	// add an onclick listener to the bars
	$('.graph__bar').on('click', function() {
		if ($(this).hasClass('selected-bar')) {
			// if this bar was already selected de-select it
			$(this).removeClass('selected-bar');
			// filter by all
			tweetTracker('filterTweets')();
		}
		else {
			// else de-select any previously selected bars
			for (var i = 0; i < $bars.length; i++) {
				if ($($bars[i]).hasClass('selected-bar')) {
					$($bars[i]).removeClass('selected-bar');
				}
			}
			// select this bar
			$(this).addClass('selected-bar');
			// get its matching label and filter by that label
			var num = $(this).attr('id').substring('graph__bar-'.length);
			var labelId = '#x-axis__label-' + num;
			var label = $(labelId).text();
			tweetTracker('filterTweets')(label);
		}
	});
	
	var updateAxis = function() {
		var prefix = 'y-axis__label';
		// get all the axis labels
		var $axisLabels = $('.'+prefix);
		for (var i = 0; i < $axisLabels.length; i++) {
			// parse the number of the axis (between 1 - 5)
				
			// fade out the old label and fade in the new label
			$($axisLabels[i]).fadeOut(1000, function() {
				var axisNum = parseInt(this.id.substring(prefix.length+1));
				// get the new label
				var count = Math.floor(axisNum * maxCount / 5);
				console.log(count);
				$(this).text(count).fadeIn(1000);
			});
		}
	};

	var updateGraph = function() {
		updateAxis();
		// resize the bars at a higher rate
		var oldUpdateRate = updateRate;
		updateRate = 1000;
		for (var i = 0; i < bars.length; i++) {
			// force the bars to resize with the new max count
			tweetGraph('updateCount')(bars[i].label, bars[i].count);
		}
		updateRate = oldUpdateRate;
		/*
		$('#test').fadeOut(1000, function() {
	        $(this).text('Some other text!').fadeIn(1000);
	    });*/
	};

	updateAxis();

	return function(msg) {
		if (msg === 'updateCount') {
			return function(label, count) {
				var highest = 0;
				// for each bar look for the one with the matching label
				for (var i = 0; i < bars.length; i++) {
					if (bars[i].label === label) {
						// update the count
						bars[i].count = count;
						// get the px height using the (px/count) ratio of the graph
						var barHeight = graphHeight / maxCount * count;
						var barId = idPrefix + (i+1);// get the bars id
						$(barId).animate({height: barHeight}, updateRate);// animate the height change
						var labelSel = barId + ' .graph__bar__label';// get the label that decends from this bar (note the space)

						//$(labelSel).text(count);// set the labels count
						if (barHeight > 25) {
							$(labelSel).fadeOut(labelRate, function() {
								$(labelSel).text(count).fadeIn(labelRate);
							});
						}
						else {
							$(labelSel).text('');
						}
						
						// if the bar is too small don't show text
						if (barHeight < 15) {
							$(labelSel).text('');
						}
					}
					// find the highest of all the bars
					if (bars[i].count > highest) {
						highest = bars[i].count;
					}
				}
				// if the highest is getting near the top of the graph make it bigger
				if (highest > (maxCount * 0.9)) {
					maxCount = Math.floor(maxCount * 1.5);
					// Round maxCount to the next multiple of 5 so the axis labels will be clean be default
					maxCount += (5 - maxCount % 5) % 5;
					updateGraph();
				}
			};
		}
		if (msg === 'resetGraph') {
			return function() {
				for (var i = 0; i < bars.length; i++) {
					tweetGraph('updateCount')(bar.label, 0);
				}
				$('.x-axis__label').text('');
				bars = [];
				maxCount = initCount;
			};
		}
		if (msg === 'setLabels') {
			return function(labels) {
				for (var i = 0; i < labels.length; i++) {
					var idNum = (i+1);
					var idSel = '#x-axis__label-' + idNum;
					console.log(idSel);
					console.log($(idSel));
					$(idSel).text(labels[i]);
					bars.push({label: labels[i], count: 0});
				}
			};
		}
	};
}());

var tweetFeed = (function() {
	var tweets = [];
	var tweetElements = [];
	var $tweetAnchor = $('.twitter-feed');
	var $scrollAnchor = $('.feed__area');
	var selectedTweet = null;

	// create a new html element for the tweet
	var getTweetHtml = function(content, idNum) {
		var id = 'tweet-id-' + idNum;// get the id tag
		// make a tweet-box div and add an onclick handler
		var html = $('<div>').addClass('tweet-box').attr('id', id).on('click', function() {
			if ($(this).hasClass('selected-tweet')) {
				$(this).removeClass('selected-tweet');
				selectedTweet = null;
			}
			else {
				focusOnTweet(html, true);
			}
		});
		// append a new tweet with the text
		html.append($('<p>').addClass('tweet').text(content));
		return html;
	};

	// focus on a given tweet element
	// if click is true it changes the class and doesn't animate 
	var focusOnTweet = function(tweet, click) {
		if (selectedTweet && $(selectedTweet).hasClass('selected-tweet')) {
			$(selectedTweet).removeClass('selected-tweet');
		}
		selectedTweet = tweet;
		if (click) {
			$(selectedTweet).addClass('selected-tweet');
			$scrollAnchor.scrollTo(tweet);
		}
		else {
			$scrollAnchor.scrollTo(tweet, 500);
		}
	};

	var addTweet = function(tweet) {
		tweets.push(tweet);
		var tweetHtml = getTweetHtml(tweet, tweets.length);
		$tweetAnchor.append(tweetHtml);
		if (selectedTweet) {
			focusOnTweet(selectedTweet, true);
		}
		else {
			focusOnTweet(tweetHtml, false);
		}
	};

	return function(msg) {
		if (msg === 'addTweet') {
			return addTweet;
		}
		if (msg === 'addTweets') {
			return function(tweetList) {
				for (var i = 0; i < tweetList.length; i++) {
					addTweet(tweetList[i]);
				}
			};
		}
		if (msg === 'clearTweets') {
			return function() {
				tweets = [];
				$tweetAnchor.empty();
			};
		}
	};

}());



