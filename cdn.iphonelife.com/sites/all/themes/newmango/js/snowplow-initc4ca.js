// <!-- Snowplow starts plowing -->
;(function(p,l,o,w,i,n,g){if(!p[i]){p.GlobalSnowplowNamespace=p.GlobalSnowplowNamespace||[];
p.GlobalSnowplowNamespace.push(i);p[i]=function(){(p[i].q=p[i].q||[]).push(arguments)
};p[i].q=p[i].q||[];n=l.createElement(o);g=l.getElementsByTagName(o)[0];n.async=1;
n.src=w;g.parentNode.insertBefore(n,g)}}(window,document,"script","//cdn.iphonelife.com/sites/all/themes/newmango/js/spt2.js","snowplow"));

window.snowplow('newTracker', 'cf', 'c.iphonelife.com', { // Initialise a tracker
    appId: 'iphonelife',
    discoverRootDomain: true,
    forceSecureTracker: true,
    contexts: {
        webPage: true,
        gaCookies: true
    }
});

window.snowplow('enableLinkClickTracking');
window.snowplow('trackPageView');
window.snowplow('enableActivityTracking', 30, 10);


// set the domain id to be used in other tools like wasabi
window.snowplow(function () {
    var cf = this.cf;
    window.spDomainUserId = cf.getDomainUserId();
})

function ensureSnowplowIsSet() {
    return new Promise(function (resolve, reject) {
        (function waitForSP(){
            if (window.spDomainUserId) return resolve();
            setTimeout(waitForSP, 30);
        })();
    });
}


// <!-- Snowplow stops plowing -->
