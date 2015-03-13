
(function () {
	"use strict";

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

	var main = function() {

	};

	$(document).ready(function() {
		main();
	});
}());