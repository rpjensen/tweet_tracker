(function () {
	//"use strict";
	
	var express = require("express"),
			http = require("http"),
			app = express(),
			redis = require('redis'),
			ntwitter = require('ntwitter'),
			credentials = require('./credentials.json'),
			twitter = ntwitter(credentials);

	
	var url = require('url');
	if (typeof process.env.REDISCLOUD_URL != 'undefined') {
		/* Heroku */
		var redisURL = url.parse(process.env.REDISCLOUD_URL);
		var client = redis.createClient(redisURL.port, redisURL.hostname);//, {no_ready_check: true}
		client.auth(redisURL.auth.split(":")[1]);
		console.log(client);
	}
	else {
		/* Local */
		var client = redis.createClient();
	}
	
	
	//
	
	


	app.use(express.static(__dirname));
	app.get('/', function(req, res) {
	  res.render('index.html');
	});
	var port = Number(process.env.PORT || 3000);
	app.listen(port, function() {
	  console.log("Listening on " + port);
	});
	
	// add a tweet
	var addTweet = (function() {
		// the current insert id
		var count = 0;
		// the actual add tweet function
		return function (filter, text) {
			console.log("add tweet called for " + filter);
			count++;// inc the count
			// a tweet has a filter and the text
			client.hmset(count, "filter", filter, "tweet", text);// the key is just the count
			client.expire(count, 10);// set the expiration time for the tweet
		};
	}());

	// get the list of filters
	var getFilters = function(req, res) {
		res.send(filters);
	};

	// a function to get all the current tweets
	var getTweets = function(req, res) {
		console.log("get tweets started");
		
		
		// get all the keys
		var keysCallback = function (keys) {
			
			console.log("keysCallback got keys");
			var updates = {counts : [], tweets : []};
			// create the container for the tweets we fetch
			for (var i = 0; i < filters.length; i++) {
				updates.counts.push({filter : filters[i], count : 0});
			} 

			var waiting = keys.length;
			var getDone = function() {
				waiting--;
				if (waiting <= 0) {
					updates.tweets.sort(function(a, b) {
						// a < b => -, a > b => +, a = b => 0
						return parseInt(a.id) - parseInt(b.id);
					});
					console.log("Sending Updates");
					console.log(updates);
					res.send(updates);	
				}
			};
			// for each key get the hash set that contains the tweet
			keys.forEach(function(val, i) {
				console.log("calling hgetall on key " + val);
				client.hgetall(val, function (err, object) {
					console.log("inside hgetall respon for key " + val);
					if (err) {
						console.log("Error getting tweet " + val);
					}
					else if (object) {
						// Process the object
						object.id = val;
						console.log("Transformed object " + object);
						updates.tweets.push(object);
						for (var j = 0; j < updates.counts.length; j++) {
							if (updates.counts[j].filter === object.filter) {
								updates.counts[j].count++;
							}
						}
					}
					getDone();
				});
			});	
		};
		client.keys('*', function (err, keys) {
			console.log(keys.toString());
			var parsedKeys = keys.toString().split(",");
			console.log(parsedKeys);
			keysCallback(parsedKeys);
		});
		
	};
	
	app.get("/getTweets", getTweets);
	app.get("/getFilters", getFilters);

	// the filters to track tweets of
	var filters = ["dark matter", "homeopathy", "global warming", "climate change", "vaccine", "gmo"];
	var splitFilters = [];// the filters separated by whitespace
	var allFilters = [];// all the filters (used to get all possible tweets from the twitter api)
	for (var i = 0; i < filters.length; i++) {
		splitFilters.push(filters[i].split(" "));
		for (var j = 0; j < splitFilters[i].length; j++) {
			allFilters.push(splitFilters[i][j]);
		}
	}

	// track tweets from twitter
	twitter.stream(
		"statuses/filter",
		{"track": allFilters},
		function(stream) {
			stream.on("data", function(tweet) {
				// for each filter
				for (var i = 0; i < splitFilters.length; i++) {
					// if the match falls through and is still true we have a full match
					var match = true;
					for (var j = 0; j < splitFilters[i].length; j++) {
						// if a word for this filter doesn't match the whole thing doesn't match
						if (tweet.text.indexOf(splitFilters[i][j]) === -1) {
							match = false;
							break;
						}
					}
					if (match) {
						// add the tweet and matching filter
						addTweet(filters[i], tweet.text);
					}
				}
			});
		}
	);

}());


