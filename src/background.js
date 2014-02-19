"use strict";

var config  = {
    github_url              : "https://github.com/", // GitHub
    github_endpoints_url    : "https://api.github.com/", // GitHub endpoints
    updateInterval          : 60, // in seconds
    updateMaxInterval       : 15, // not more often than every X seconds
    maxNotifs               : 5 // max notifs at a time, also used for notifs reset
};

var app = {

    notifsCache     : [], // used for click events
    access_token    : null, // GitHub Personal Access Token
    timer           : null, // for the setTimeout() loop
    
    start : function () {

        // Check for access token
        this.getAccessToken(function(access_token) {

            if (!access_token) {

                console.warn('Access token not set, opening options page...');
                window.open('options.html');
                return;
            }

            // Get GitHub endpoints
            app.githubGetEndpoints(function (endpoints) {

                config.github_endpoints = endpoints;

                // Get the User
                app.githubGetUser( function () {

                    // Get the User's received events
                    app.getEvents();
                });

            });

        });
    },

    showNotification : function (id, title, message, contextMessage, time, url) {

        window.setTimeout( function() {

            var notifOptions = {
                type            : "basic",
                iconUrl         : "img/icon_64.png",
                title           : title,
                message         : message,
                contextMessage  : contextMessage,
                eventTime       : time
            };

            // Create the notification
            chrome.notifications.create(id, notifOptions, function(id) {

                console.info('Notification ID '+id+' sent');
                app.notifsCache[id] =   url;
            });

        }, 250); // create notification with a slight delay to allow time for generation
    },

    resetNotifications : function (callback) {

        // Remove the last event date 
        chrome.storage.sync.remove('last_event_date', function() {

            if (callback)
                callback();
        });
    },

    clearNotifications : function (callback) {

        // Get all the notifications
        chrome.notifications.getAll( function(notifs) {

            if (notifs) {

                for (var notif in notifs) {

                    // Clear this notification
                    chrome.notifications.clear( notif, function () {} );
                }
                if (callback)
                    callback();
            }
        });
    },

    getEvents : function () {

        // Get the User's events
        app.githubGetUserReceivedEvents( function (events) {

            if (!events)
                return;

            // Check if there is a last date stored
            chrome.storage.sync.get(function (storage) {

                if (storage && storage.last_event_date) {
                    window.clearTimeout(app.timer);

                    var pushedNotifs    = 0;

                    // Last date present, start loop to compare

                    var last_timestamp  = false;

                    for (var x = events.length-1; x >= 0; x--) {
                        (function(x, events) {


                            var thisEvent   = events[x];
                            if (thisEvent && thisEvent.created_at) {

                                var thisEventTimestamp  = new Date(thisEvent.created_at);
                                var thisEventDate       = formatDate(thisEventTimestamp);
                                last_timestamp  = thisEventTimestamp    = thisEventTimestamp.getTime();

                                if (typeof thisEventTimestamp != 'undefined' && thisEventTimestamp > storage.last_event_date) {

                                    if (thisEvent.type == 'PushEvent') {

                                        for (var y = thisEvent.payload.commits.length-1; y >= 0; y--) {

                                            var title   = 'PUSH ' + thisEvent.payload.commits[y].message;
                                            var message = 'Repo: ' + thisEvent.repo.name + '\n' +
                                                'Actor: ' + thisEvent.actor.login +
                                                (thisEvent.payload.commits[y].author && thisEvent.payload.commits[y].author.name && thisEvent.payload.commits[y].author.name != 'unknown' ? ' (aka ' + thisEvent.payload.commits[y].author.name + ')' : '');
                                            var contextMessage  = thisEventDate;
                                            var url = config.github_url + thisEvent.repo.name + '/commit/' + thisEvent.payload.commits[y].sha; // thisEvent.payload.commits[y].url;

                                            app.showNotification.apply(this, [thisEvent.id, title, message, contextMessage, thisEventTimestamp, url]);
                                            pushedNotifs++;
                                        }

                                    } else if (thisEvent.type == 'CommitCommentEvent') {

                                        var title   = 'COMMENT ' + thisEvent.payload.comment.body;
                                        var message = 'Repo: ' + thisEvent.repo.name + '\n' + 'Actor: ' + thisEvent.actor.login;
                                        var contextMessage  = thisEventDate;
                                        var url = thisEvent.payload.comment.html_url;

                                        app.showNotification.apply(this, [thisEvent.id, title, message, contextMessage, thisEventTimestamp, url]);
                                        pushedNotifs++;

                                    } else if (thisEvent.type == 'ReleaseEvent') {

                                        var title   = 'RELEASE ' + thisEvent.payload.release.name;
                                        var message = 'Repo: ' + thisEvent.repo.name + '\n' + 'Actor: ' + thisEvent.actor.login;
                                        var contextMessage  = thisEventDate;
                                        var url = thisEvent.payload.release.html_url;

                                        app.showNotification.apply(this, [thisEvent.id, title, message, contextMessage, thisEventTimestamp, url]);
                                        pushedNotifs++;
                                    }
                                }
                            }

                        })(x, events);
                    }

                    if (last_timestamp) {

                        chrome.storage.sync.set({ 'last_event_date': last_timestamp }, function () {

                            app.timer = window.setTimeout(function() {
                                app.getEvents();
                            }, config.updateInterval * 1000);
                        });

                    } else {

                        app.timer = window.setTimeout(function() {
                            app.getEvents();
                        }, config.updateInterval * 1000);
                    }

                } else {

                    // Try to get up to the last x events and store date
                    var eventsNum   = Math.min(events.length, config.maxNotifs-1);

                    if (events[eventsNum] && events[eventsNum].created_at) {

                        var timestamp   = new Date(events[eventsNum].created_at);
                        timestamp   = timestamp.getTime() - 1; // subtract a second to display this event

                        chrome.storage.sync.set({ 'last_event_date': timestamp }, function () {

                            app.getEvents();
                        });
                    }
                }
            });
        });
    },

    getAccessToken : function (callback) {

        chrome.storage.sync.get(function (storage) {

            callback ( (!storage.access_token) ? false : storage.access_token );
        });
    },

    githubGetUserReceivedEvents : function (callback) {

        var params = {
            'access_token' : app.access_token
        };

        ajaxGitHub('GET', config.user.received_events_url, params, function (data) {

                if (data && data.status && data.status != 200) {

                    console.error(data);
                    data = false;

                } else {

                    data = JSON.parse(data);
                }

                if (callback)
                    callback( data );
            }
        );
    },

    githubGetEndpoints : function (callback) {

        // Get Access Token
        this.getAccessToken( function (access_token) {

            app.access_token = access_token;

            // check if they are stored
            chrome.storage.sync.get('endpoints', function (storage) {

                if (storage && typeof storage == 'object' && storage.endpoints) {

                    if (callback)
                        callback(storage.endpoints);

                } else {

                    var params = {
                        'access_token' : app.access_token
                    };

                    ajaxGitHub('GET', config.github_endpoints_url, params, function (data) {

                            if (data && data.status && data.status != 200) {

                                console.error(data);

                                alert('Error retrieving the endpoints!\n' +
                                    'Reason: ' + JSON.parse(data.responseText).message);

                                window.open('options.html');


                            } else {

                                data = JSON.parse(data);

                                app.saveGitHubEndpoints(data);

                                if (callback)
                                    callback(data);

                            }
                        }
                    );
                }
            });
        });
    },

    saveGitHubEndpoints : function (endpoints) {

        endpoints = {
            'endpoints' : endpoints
        };

        chrome.storage.sync.set(endpoints, function () {
            return true;
        });

    },

    githubGetUser : function (callback) {

        var params = {
            'access_token' : app.access_token
        };

        ajaxGitHub('GET', config.github_endpoints.current_user_url, params, function (data) {

                if (data && data.status && data.status != 200) {

                    alert('Error retrieving your user name!\n' +
                        'Reason: ' + JSON.parse(data.responseText).message);

                    window.open('options.html');

                } else {

                    data = JSON.parse(data);

                    config.user = data;

                    if (callback)
                        callback(data);

                }
            }
        );
    }
};


var ajaxGitHub = function (method, url, params, callback) {

    var xhr = new XMLHttpRequest();

    if (method == 'GET') {
        url += '?' + encodeQueryData(params);
    }

    xhr.open(method, url, true);

    xhr.onreadystatechange = function () {

        if (callback) {

            if (xhr.readyState == 4 && xhr.status == 200) {

                // Handle GitHub's rate limiting
                var rateLimit   = xhr.getResponseHeader('X-RateLimit-Limit');
                if (rateLimit) {
                    config.updateInterval   = Math.max( (60 / rateLimit) * 60, config.updateMaxInterval);
                }

                    if (xhr.responseText.indexOf('/**/' + callback) != -1) {

                        var resp = JSONPCallbackToJSONObject(xhr.responseText, callback);
                        callback(JSON.parse(resp));

                    } else {

                        callback(xhr.responseText);
                    }

            } else if (xhr.readyState == 4) {

                callback(xhr);
            }
        }
    };

    // Send the proper header information along with the request
    xhr.setRequestHeader("Content-type", "application/json; charset=utf-8");
    xhr.setRequestHeader("Accept", "application/vnd.github.v3+json");

    switch (method) {

        case 'GET':
            xhr.send();
            break;
        case 'POST':
            xhr.send(params);
            break;
        default:
            break;
    }
};

function encodeQueryData(data) {
    var ret = [];
    for (var d in data) {
        if (data.hasOwnProperty(d)) {
            ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
        }
    }
    return ret.join("&");
}

function JSONPCallbackToJSONObject(jsonpString, callbackName) {
    return jsonpString.slice(4 + callbackName.length + 1, jsonpString.length - 2);
}

function formatDate(thedate) {

    var theMonth    = thedate.getMonth() + 1;
    theMonth        = (theMonth < 10) ? '0'+theMonth : theMonth;

    var theDay      = thedate.getDate();
    theDay          = (theDay < 10) ? '0'+theDay : theDay;

    var theYear     = thedate.getFullYear();

    var theHours    = thedate.getHours() + 1;
    var theMeridiem = (theHours>11) ? 'PM' : 'AM';
    theHours        = (theHours > 12) ? theHours-12 : theHours;
    theHours        = (theHours < 10) ? '0'+theHours : theHours;

    var theMinutes  = thedate.getMinutes();
    theMinutes      = (theMinutes < 10) ? '0'+theMinutes : theMinutes;

    return theMonth + '/' + theDay + '/' + theYear + ' ' + theHours + ':' + theMinutes + ' ' + theMeridiem;
}

function getManifest(callback) {

    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.extension.getURL('/manifest.json'), true);

    xhr.onreadystatechange = function () {

        if (xhr.readyState == 4 && xhr.status == 200) {

            if (callback)
                callback( JSON.parse(xhr.responseText) );

        } else if (xhr.readyState == 4) {

            console.error('Could not read /manifest.json');
            if (callback)
                callback( false );
        }
    };
    xhr.send();
}

// Listen to click events on notifications
chrome.notifications.onClicked.addListener( function (id) {

    window.open(app.notifsCache[id]);
});


// Start it up!
app.start();
