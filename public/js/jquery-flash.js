var notLocked = true;
$.fn.animateHighlight = function(highlightColor, duration) {
    var highlightBg = highlightColor || "#FFFF9C";
    var animateMs = duration || 1500;
    var originalBg = this.css("backgroundColor");
    if(notLocked){
        notLocked = false;
        this.stop().css("background-color", highlightBg).animate({backgroundColor: originalBg}, animateMs);
        setTimeout( function() { notLocked = true; },animateMs);
    }
};
