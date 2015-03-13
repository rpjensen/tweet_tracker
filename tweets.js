
(function () {
	"use strict";

	// Extend the jquery library to scroll the caller(s) to the given element
	jQuery.fn.scrollTo = function(elem, speed) { 
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
		$('.graph__bar').on('click', function() {
			$(this).animate({height: $(this).height() + 10});
		})
		
	};

	$(document).ready(function() {
		main();
	});
}());

/**
* Tweet tracker holds a list of tweet filters
* 
*/
var tweetTracker = (function() {
	"use strict";
	var newTweetLabel =  function() {
		var label = '';
		var count = 0;
		var callbackG = function() {};
		var tweets = [];
		var callbackT = function() {};
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
			// Set the callback for the count
			if (msg === 'setGraphCallback') {
				return function(value) {
					if (typeof value == 'function') {
						callbackG = value;
					}
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
						callbackG(value);
					}
				};
			}
			// increment the current count
			if (msg === 'addCount') {
				return function(value) {
					if (typeof value == "number") {
						count += value;
						callbackG(count);
					}
				};
			}
			// Add a tweet
			if (msg === 'addTweet') {
				return function(tweet) {
					tweets.push(tweet);
					callbackT(tweet);
				};
			}
			// Set the tweet callback
			if (msg === 'setTweetCallback') {
				return function(value) {
					if (typeof value == "function") {
						callbackT = value;
					}
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
	var tweetLabels = [];

	return function(msg) {
		// Reset the filters
		if (msg === "resetLabels") {
			tweetLabels = [];
		}
		// Add a filter
		if (msg === "addLabel") {
			return function(label, callbackGraph, callbackFeed) {
				// create a new tweet label
				var tl = newTweetLabel()
				tl('setLabel')(label);// set the label name
				tl('setGraphCallback')(callbackGraph);// set the graph callback
				tl('setTweetCallback')(callbackFeed);// set the tweet callback
				tweetLabels.push(tl);// add it to the list
			};
		}
		// Update Tweets and counts {key: "label", count : 5, tweets : [t1, t2, ...]}
		if (msg === "update") {
			return function(updates) {
				// for each update
				for (var i = 0; i < updates.length; i++) {
					var update = updates[i];// get the update
					// for each tweet filter
					for (var j = 0; j < tweetLabels.length; j++) {
						// check if the update key is the same as the tweet filter label
						if (update.key === tweetLabels[j]('getLabel')()) {
							// update the count
							tweetLabels[j]('addCount')(update.count);
							// update the tweets
							for (var k = 0; k < update.tweets.length; k++) {
								tweetLabels[j]('addTweet')(update.tweets[k]);
							}
						}
					}
				}
			};
		}
		// Get an array of all the current labels
		if (msg === "getLabels") {
			return function() {
				var list = [];
				for (var i = 0; i < tweetLabels.length; i++) {
					list.push(tweetLabels("getLabel")());
				}
			}
		}
	};

}());

