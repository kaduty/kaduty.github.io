
/**
 * jQuery Once Plugin v1.2
 * http://plugins.jquery.com/project/once
 *
 * Dual licensed under the MIT and GPL licenses:
 *   http://www.opensource.org/licenses/mit-license.php
 *   http://www.gnu.org/licenses/gpl.html
 */

(function ($) {
  var cache = {}, uuid = 0;

  /**
   * Filters elements by whether they have not yet been processed.
   *
   * @param id
   *   (Optional) If this is a string, then it will be used as the CSS class
   *   name that is applied to the elements for determining whether it has
   *   already been processed. The elements will get a class in the form of
   *   "id-processed".
   *
   *   If the id parameter is a function, it will be passed off to the fn
   *   parameter and the id will become a unique identifier, represented as a
   *   number.
   *
   *   When the id is neither a string or a function, it becomes a unique
   *   identifier, depicted as a number. The element's class will then be
   *   represented in the form of "jquery-once-#-processed".
   *
   *   Take note that the id must be valid for usage as an element's class name.
   * @param fn
   *   (Optional) If given, this function will be called for each element that
   *   has not yet been processed. The function's return value follows the same
   *   logic as $.each(). Returning true will continue to the next matched
   *   element in the set, while returning false will entirely break the
   *   iteration.
   */
  $.fn.once = function (id, fn) {
    if (typeof id != 'string') {
      // Generate a numeric ID if the id passed can't be used as a CSS class.
      if (!(id in cache)) {
        cache[id] = ++uuid;
      }
      // When the fn parameter is not passed, we interpret it from the id.
      if (!fn) {
        fn = id;
      }
      id = 'jquery-once-' + cache[id];
    }
    // Remove elements from the set that have already been processed.
    var name = id + '-processed';
    var elements = this.not('.' + name).addClass(name);

    return $.isFunction(fn) ? elements.each(fn) : elements;
  };

  /**
   * Filters elements that have been processed once already.
   *
   * @param id
   *   A required string representing the name of the class which should be used
   *   when filtering the elements. This only filters elements that have already
   *   been processed by the once function. The id should be the same id that
   *   was originally passed to the once() function.
   * @param fn
   *   (Optional) If given, this function will be called for each element that
   *   has not yet been processed. The function's return value follows the same
   *   logic as $.each(). Returning true will continue to the next matched
   *   element in the set, while returning false will entirely break the
   *   iteration.
   */
  $.fn.removeOnce = function (id, fn) {
    var name = id + '-processed';
    var elements = this.filter('.' + name).removeClass(name);

    return $.isFunction(fn) ? elements.each(fn) : elements;
  };
})(jQuery);

;/*})'"*/
;/*})'"*/

var Drupal = Drupal || { 'settings': {}, 'behaviors': {}, 'locale': {} };

// Allow other JavaScript libraries to use $.
jQuery.noConflict();

(function ($) {

/**
 * Override jQuery.fn.init to guard against XSS attacks.
 *
 * See http://bugs.jquery.com/ticket/9521
 */
var jquery_init = $.fn.init;
$.fn.init = function (selector, context, rootjQuery) {
  // If the string contains a "#" before a "<", treat it as invalid HTML.
  if (selector && typeof selector === 'string') {
    var hash_position = selector.indexOf('#');
    if (hash_position >= 0) {
      var bracket_position = selector.indexOf('<');
      if (bracket_position > hash_position) {
        throw 'Syntax error, unrecognized expression: ' + selector;
      }
    }
  }
  return jquery_init.call(this, selector, context, rootjQuery);
};
$.fn.init.prototype = jquery_init.prototype;

/**
 * Pre-filter Ajax requests to guard against XSS attacks.
 *
 * See https://github.com/jquery/jquery/issues/2432
 */
if ($.ajaxPrefilter) {
  // For newer versions of jQuery, use an Ajax prefilter to prevent
  // auto-executing script tags from untrusted domains. This is similar to the
  // fix that is built in to jQuery 3.0 and higher.
  $.ajaxPrefilter(function (s) {
    if (s.crossDomain) {
      s.contents.script = false;
    }
  });
}
else if ($.httpData) {
  // For the version of jQuery that ships with Drupal core, override
  // jQuery.httpData to prevent auto-detecting "script" data types from
  // untrusted domains.
  var jquery_httpData = $.httpData;
  $.httpData = function (xhr, type, s) {
    // @todo Consider backporting code from newer jQuery versions to check for
    //   a cross-domain request here, rather than using Drupal.urlIsLocal() to
    //   block scripts from all URLs that are not on the same site.
    if (!type && !Drupal.urlIsLocal(s.url)) {
      var content_type = xhr.getResponseHeader('content-type') || '';
      if (content_type.indexOf('javascript') >= 0) {
        // Default to a safe data type.
        type = 'text';
      }
    }
    return jquery_httpData.call(this, xhr, type, s);
  };
  $.httpData.prototype = jquery_httpData.prototype;
}

/**
 * Attach all registered behaviors to a page element.
 *
 * Behaviors are event-triggered actions that attach to page elements, enhancing
 * default non-JavaScript UIs. Behaviors are registered in the Drupal.behaviors
 * object using the method 'attach' and optionally also 'detach' as follows:
 * @code
 *    Drupal.behaviors.behaviorName = {
 *      attach: function (context, settings) {
 *        ...
 *      },
 *      detach: function (context, settings, trigger) {
 *        ...
 *      }
 *    };
 * @endcode
 *
 * Drupal.attachBehaviors is added below to the jQuery ready event and so
 * runs on initial page load. Developers implementing AHAH/Ajax in their
 * solutions should also call this function after new page content has been
 * loaded, feeding in an element to be processed, in order to attach all
 * behaviors to the new content.
 *
 * Behaviors should use
 * @code
 *   $(selector).once('behavior-name', function () {
 *     ...
 *   });
 * @endcode
 * to ensure the behavior is attached only once to a given element. (Doing so
 * enables the reprocessing of given elements, which may be needed on occasion
 * despite the ability to limit behavior attachment to a particular element.)
 *
 * @param context
 *   An element to attach behaviors to. If none is given, the document element
 *   is used.
 * @param settings
 *   An object containing settings for the current context. If none given, the
 *   global Drupal.settings object is used.
 */
Drupal.attachBehaviors = function (context, settings) {
  context = context || document;
  settings = settings || Drupal.settings;
  // Execute all of them.
  $.each(Drupal.behaviors, function () {
    if ($.isFunction(this.attach)) {
      this.attach(context, settings);
    }
  });
};

/**
 * Detach registered behaviors from a page element.
 *
 * Developers implementing AHAH/Ajax in their solutions should call this
 * function before page content is about to be removed, feeding in an element
 * to be processed, in order to allow special behaviors to detach from the
 * content.
 *
 * Such implementations should look for the class name that was added in their
 * corresponding Drupal.behaviors.behaviorName.attach implementation, i.e.
 * behaviorName-processed, to ensure the behavior is detached only from
 * previously processed elements.
 *
 * @param context
 *   An element to detach behaviors from. If none is given, the document element
 *   is used.
 * @param settings
 *   An object containing settings for the current context. If none given, the
 *   global Drupal.settings object is used.
 * @param trigger
 *   A string containing what's causing the behaviors to be detached. The
 *   possible triggers are:
 *   - unload: (default) The context element is being removed from the DOM.
 *   - move: The element is about to be moved within the DOM (for example,
 *     during a tabledrag row swap). After the move is completed,
 *     Drupal.attachBehaviors() is called, so that the behavior can undo
 *     whatever it did in response to the move. Many behaviors won't need to
 *     do anything simply in response to the element being moved, but because
 *     IFRAME elements reload their "src" when being moved within the DOM,
 *     behaviors bound to IFRAME elements (like WYSIWYG editors) may need to
 *     take some action.
 *   - serialize: When an Ajax form is submitted, this is called with the
 *     form as the context. This provides every behavior within the form an
 *     opportunity to ensure that the field elements have correct content
 *     in them before the form is serialized. The canonical use-case is so
 *     that WYSIWYG editors can update the hidden textarea to which they are
 *     bound.
 *
 * @see Drupal.attachBehaviors
 */
Drupal.detachBehaviors = function (context, settings, trigger) {
  context = context || document;
  settings = settings || Drupal.settings;
  trigger = trigger || 'unload';
  // Execute all of them.
  $.each(Drupal.behaviors, function () {
    if ($.isFunction(this.detach)) {
      this.detach(context, settings, trigger);
    }
  });
};

/**
 * Encode special characters in a plain-text string for display as HTML.
 *
 * @ingroup sanitization
 */
Drupal.checkPlain = function (str) {
  var character, regex,
      replace = { '&': '&amp;', "'": '&#39;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
  str = String(str);
  for (character in replace) {
    if (replace.hasOwnProperty(character)) {
      regex = new RegExp(character, 'g');
      str = str.replace(regex, replace[character]);
    }
  }
  return str;
};

/**
 * Replace placeholders with sanitized values in a string.
 *
 * @param str
 *   A string with placeholders.
 * @param args
 *   An object of replacements pairs to make. Incidences of any key in this
 *   array are replaced with the corresponding value. Based on the first
 *   character of the key, the value is escaped and/or themed:
 *    - !variable: inserted as is
 *    - @variable: escape plain text to HTML (Drupal.checkPlain)
 *    - %variable: escape text and theme as a placeholder for user-submitted
 *      content (checkPlain + Drupal.theme('placeholder'))
 *
 * @see Drupal.t()
 * @ingroup sanitization
 */
Drupal.formatString = function(str, args) {
  // Transform arguments before inserting them.
  for (var key in args) {
    if (args.hasOwnProperty(key)) {
      switch (key.charAt(0)) {
        // Escaped only.
        case '@':
          args[key] = Drupal.checkPlain(args[key]);
          break;
        // Pass-through.
        case '!':
          break;
        // Escaped and placeholder.
        default:
          args[key] = Drupal.theme('placeholder', args[key]);
          break;
      }
    }
  }

  return Drupal.stringReplace(str, args, null);
};

/**
 * Replace substring.
 *
 * The longest keys will be tried first. Once a substring has been replaced,
 * its new value will not be searched again.
 *
 * @param {String} str
 *   A string with placeholders.
 * @param {Object} args
 *   Key-value pairs.
 * @param {Array|null} keys
 *   Array of keys from the "args".  Internal use only.
 *
 * @return {String}
 *   Returns the replaced string.
 */
Drupal.stringReplace = function (str, args, keys) {
  if (str.length === 0) {
    return str;
  }

  // If the array of keys is not passed then collect the keys from the args.
  if (!$.isArray(keys)) {
    keys = [];
    for (var k in args) {
      if (args.hasOwnProperty(k)) {
        keys.push(k);
      }
    }

    // Order the keys by the character length. The shortest one is the first.
    keys.sort(function (a, b) { return a.length - b.length; });
  }

  if (keys.length === 0) {
    return str;
  }

  // Take next longest one from the end.
  var key = keys.pop();
  var fragments = str.split(key);

  if (keys.length) {
    for (var i = 0; i < fragments.length; i++) {
      // Process each fragment with a copy of remaining keys.
      fragments[i] = Drupal.stringReplace(fragments[i], args, keys.slice(0));
    }
  }

  return fragments.join(args[key]);
};

/**
 * Translate strings to the page language or a given language.
 *
 * See the documentation of the server-side t() function for further details.
 *
 * @param str
 *   A string containing the English string to translate.
 * @param args
 *   An object of replacements pairs to make after translation. Incidences
 *   of any key in this array are replaced with the corresponding value.
 *   See Drupal.formatString().
 *
 * @param options
 *   - 'context' (defaults to the empty context): The context the source string
 *     belongs to.
 *
 * @return
 *   The translated string.
 */
Drupal.t = function (str, args, options) {
  options = options || {};
  options.context = options.context || '';

  // Fetch the localized version of the string.
  if (Drupal.locale.strings && Drupal.locale.strings[options.context] && Drupal.locale.strings[options.context][str]) {
    str = Drupal.locale.strings[options.context][str];
  }

  if (args) {
    str = Drupal.formatString(str, args);
  }
  return str;
};

/**
 * Format a string containing a count of items.
 *
 * This function ensures that the string is pluralized correctly. Since Drupal.t() is
 * called by this function, make sure not to pass already-localized strings to it.
 *
 * See the documentation of the server-side format_plural() function for further details.
 *
 * @param count
 *   The item count to display.
 * @param singular
 *   The string for the singular case. Please make sure it is clear this is
 *   singular, to ease translation (e.g. use "1 new comment" instead of "1 new").
 *   Do not use @count in the singular string.
 * @param plural
 *   The string for the plural case. Please make sure it is clear this is plural,
 *   to ease translation. Use @count in place of the item count, as in "@count
 *   new comments".
 * @param args
 *   An object of replacements pairs to make after translation. Incidences
 *   of any key in this array are replaced with the corresponding value.
 *   See Drupal.formatString().
 *   Note that you do not need to include @count in this array.
 *   This replacement is done automatically for the plural case.
 * @param options
 *   The options to pass to the Drupal.t() function.
 * @return
 *   A translated string.
 */
Drupal.formatPlural = function (count, singular, plural, args, options) {
  args = args || {};
  args['@count'] = count;
  // Determine the index of the plural form.
  var index = Drupal.locale.pluralFormula ? Drupal.locale.pluralFormula(args['@count']) : ((args['@count'] == 1) ? 0 : 1);

  if (index == 0) {
    return Drupal.t(singular, args, options);
  }
  else if (index == 1) {
    return Drupal.t(plural, args, options);
  }
  else {
    args['@count[' + index + ']'] = args['@count'];
    delete args['@count'];
    return Drupal.t(plural.replace('@count', '@count[' + index + ']'), args, options);
  }
};

/**
 * Returns the passed in URL as an absolute URL.
 *
 * @param url
 *   The URL string to be normalized to an absolute URL.
 *
 * @return
 *   The normalized, absolute URL.
 *
 * @see https://github.com/angular/angular.js/blob/v1.4.4/src/ng/urlUtils.js
 * @see https://grack.com/blog/2009/11/17/absolutizing-url-in-javascript
 * @see https://github.com/jquery/jquery-ui/blob/1.11.4/ui/tabs.js#L53
 */
Drupal.absoluteUrl = function (url) {
  var urlParsingNode = document.createElement('a');

  // Decode the URL first; this is required by IE <= 6. Decoding non-UTF-8
  // strings may throw an exception.
  try {
    url = decodeURIComponent(url);
  } catch (e) {}

  urlParsingNode.setAttribute('href', url);

  // IE <= 7 normalizes the URL when assigned to the anchor node similar to
  // the other browsers.
  return urlParsingNode.cloneNode(false).href;
};

/**
 * Returns true if the URL is within Drupal's base path.
 *
 * @param url
 *   The URL string to be tested.
 *
 * @return
 *   Boolean true if local.
 *
 * @see https://github.com/jquery/jquery-ui/blob/1.11.4/ui/tabs.js#L58
 */
Drupal.urlIsLocal = function (url) {
  // Always use browser-derived absolute URLs in the comparison, to avoid
  // attempts to break out of the base path using directory traversal.
  var absoluteUrl = Drupal.absoluteUrl(url);
  var protocol = location.protocol;

  // Consider URLs that match this site's base URL but use HTTPS instead of HTTP
  // as local as well.
  if (protocol === 'http:' && absoluteUrl.indexOf('https:') === 0) {
    protocol = 'https:';
  }
  var baseUrl = protocol + '//' + location.host + Drupal.settings.basePath.slice(0, -1);

  // Decoding non-UTF-8 strings may throw an exception.
  try {
    absoluteUrl = decodeURIComponent(absoluteUrl);
  } catch (e) {}
  try {
    baseUrl = decodeURIComponent(baseUrl);
  } catch (e) {}

  // The given URL matches the site's base URL, or has a path under the site's
  // base URL.
  return absoluteUrl === baseUrl || absoluteUrl.indexOf(baseUrl + '/') === 0;
};

/**
 * Generate the themed representation of a Drupal object.
 *
 * All requests for themed output must go through this function. It examines
 * the request and routes it to the appropriate theme function. If the current
 * theme does not provide an override function, the generic theme function is
 * called.
 *
 * For example, to retrieve the HTML for text that should be emphasized and
 * displayed as a placeholder inside a sentence, call
 * Drupal.theme('placeholder', text).
 *
 * @param func
 *   The name of the theme function to call.
 * @param ...
 *   Additional arguments to pass along to the theme function.
 * @return
 *   Any data the theme function returns. This could be a plain HTML string,
 *   but also a complex object.
 */
Drupal.theme = function (func) {
  var args = Array.prototype.slice.apply(arguments, [1]);

  return (Drupal.theme[func] || Drupal.theme.prototype[func]).apply(this, args);
};

/**
 * Freeze the current body height (as minimum height). Used to prevent
 * unnecessary upwards scrolling when doing DOM manipulations.
 */
Drupal.freezeHeight = function () {
  Drupal.unfreezeHeight();
  $('<div id="freeze-height"></div>').css({
    position: 'absolute',
    top: '0px',
    left: '0px',
    width: '1px',
    height: $('body').css('height')
  }).appendTo('body');
};

/**
 * Unfreeze the body height.
 */
Drupal.unfreezeHeight = function () {
  $('#freeze-height').remove();
};

/**
 * Encodes a Drupal path for use in a URL.
 *
 * For aesthetic reasons slashes are not escaped.
 */
Drupal.encodePath = function (item, uri) {
  uri = uri || location.href;
  return encodeURIComponent(item).replace(/%2F/g, '/');
};

/**
 * Get the text selection in a textarea.
 */
Drupal.getSelection = function (element) {
  if (typeof element.selectionStart != 'number' && document.selection) {
    // The current selection.
    var range1 = document.selection.createRange();
    var range2 = range1.duplicate();
    // Select all text.
    range2.moveToElementText(element);
    // Now move 'dummy' end point to end point of original range.
    range2.setEndPoint('EndToEnd', range1);
    // Now we can calculate start and end points.
    var start = range2.text.length - range1.text.length;
    var end = start + range1.text.length;
    return { 'start': start, 'end': end };
  }
  return { 'start': element.selectionStart, 'end': element.selectionEnd };
};

/**
 * Add a global variable which determines if the window is being unloaded.
 *
 * This is primarily used by Drupal.displayAjaxError().
 */
Drupal.beforeUnloadCalled = false;
$(window).bind('beforeunload pagehide', function () {
    Drupal.beforeUnloadCalled = true;
});

/**
 * Displays a JavaScript error from an Ajax response when appropriate to do so.
 */
Drupal.displayAjaxError = function (message) {
  // Skip displaying the message if the user deliberately aborted (for example,
  // by reloading the page or navigating to a different page) while the Ajax
  // request was still ongoing. See, for example, the discussion at
  // http://stackoverflow.com/questions/699941/handle-ajax-error-when-a-user-clicks-refresh.
  if (!Drupal.beforeUnloadCalled) {
    alert(message);
  }
};

/**
 * Build an error message from an Ajax response.
 */
Drupal.ajaxError = function (xmlhttp, uri, customMessage) {
  var statusCode, statusText, pathText, responseText, readyStateText, message;
  if (xmlhttp.status) {
    statusCode = "\n" + Drupal.t("An AJAX HTTP error occurred.") +  "\n" + Drupal.t("HTTP Result Code: !status", {'!status': xmlhttp.status});
  }
  else {
    statusCode = "\n" + Drupal.t("An AJAX HTTP request terminated abnormally.");
  }
  statusCode += "\n" + Drupal.t("Debugging information follows.");
  pathText = "\n" + Drupal.t("Path: !uri", {'!uri': uri} );
  statusText = '';
  // In some cases, when statusCode == 0, xmlhttp.statusText may not be defined.
  // Unfortunately, testing for it with typeof, etc, doesn't seem to catch that
  // and the test causes an exception. So we need to catch the exception here.
  try {
    statusText = "\n" + Drupal.t("StatusText: !statusText", {'!statusText': $.trim(xmlhttp.statusText)});
  }
  catch (e) {}

  responseText = '';
  // Again, we don't have a way to know for sure whether accessing
  // xmlhttp.responseText is going to throw an exception. So we'll catch it.
  try {
    responseText = "\n" + Drupal.t("ResponseText: !responseText", {'!responseText': $.trim(xmlhttp.responseText) } );
  } catch (e) {}

  // Make the responseText more readable by stripping HTML tags and newlines.
  responseText = responseText.replace(/<("[^"]*"|'[^']*'|[^'">])*>/gi,"");
  responseText = responseText.replace(/[\n]+\s+/g,"\n");

  // We don't need readyState except for status == 0.
  readyStateText = xmlhttp.status == 0 ? ("\n" + Drupal.t("ReadyState: !readyState", {'!readyState': xmlhttp.readyState})) : "";

  // Additional message beyond what the xmlhttp object provides.
  customMessage = customMessage ? ("\n" + Drupal.t("CustomMessage: !customMessage", {'!customMessage': customMessage})) : "";

  message = statusCode + pathText + statusText + customMessage + responseText + readyStateText;
  return message;
};

// Class indicating that JS is enabled; used for styling purpose.
$('html').addClass('js');

// 'js enabled' cookie.
document.cookie = 'has_js=1; path=/';

/**
 * Additions to jQuery.support.
 */
$(function () {
  /**
   * Boolean indicating whether or not position:fixed is supported.
   */
  if (jQuery.support.positionFixed === undefined) {
    var el = $('<div style="position:fixed; top:10px" />').appendTo(document.body);
    jQuery.support.positionFixed = el[0].offsetTop === 10;
    el.remove();
  }
});

//Attach all behaviors.
$(function () {
  Drupal.attachBehaviors(document, Drupal.settings);
});

/**
 * The default themes.
 */
Drupal.theme.prototype = {

  /**
   * Formats text for emphasized display in a placeholder inside a sentence.
   *
   * @param str
   *   The text to format (plain-text).
   * @return
   *   The formatted text (html).
   */
  placeholder: function (str) {
    return '<em class="placeholder">' + Drupal.checkPlain(str) + '</em>';
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
(function ($) {
  $('html').removeClass('no-js');
})(jQuery);

;/*})'"*/
;/*})'"*/
/*jslint browser: true */ /*global jQuery: true */

/**
 * jQuery Cookie plugin
 *
 * Copyright (c) 2010 Klaus Hartl (stilbuero.de)
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

// TODO JsDoc

/**
 * Create a cookie with the given key and value and other optional parameters.
 *
 * @example $.cookie('the_cookie', 'the_value');
 * @desc Set the value of a cookie.
 * @example $.cookie('the_cookie', 'the_value', { expires: 7, path: '/', domain: 'jquery.com', secure: true });
 * @desc Create a cookie with all available options.
 * @example $.cookie('the_cookie', 'the_value');
 * @desc Create a session cookie.
 * @example $.cookie('the_cookie', null);
 * @desc Delete a cookie by passing null as value. Keep in mind that you have to use the same path and domain
 *       used when the cookie was set.
 *
 * @param String key The key of the cookie.
 * @param String value The value of the cookie.
 * @param Object options An object literal containing key/value pairs to provide optional cookie attributes.
 * @option Number|Date expires Either an integer specifying the expiration date from now on in days or a Date object.
 *                             If a negative value is specified (e.g. a date in the past), the cookie will be deleted.
 *                             If set to null or omitted, the cookie will be a session cookie and will not be retained
 *                             when the the browser exits.
 * @option String path The value of the path atribute of the cookie (default: path of page that created the cookie).
 * @option String domain The value of the domain attribute of the cookie (default: domain of page that created the cookie).
 * @option Boolean secure If true, the secure attribute of the cookie will be set and the cookie transmission will
 *                        require a secure protocol (like HTTPS).
 * @type undefined
 *
 * @name $.cookie
 * @cat Plugins/Cookie
 * @author Klaus Hartl/klaus.hartl@stilbuero.de
 */

/**
 * Get the value of a cookie with the given key.
 *
 * @example $.cookie('the_cookie');
 * @desc Get the value of a cookie.
 *
 * @param String key The key of the cookie.
 * @return The value of the cookie.
 * @type String
 *
 * @name $.cookie
 * @cat Plugins/Cookie
 * @author Klaus Hartl/klaus.hartl@stilbuero.de
 */
jQuery.cookie = function (key, value, options) {

    // key and value given, set cookie...
    if (arguments.length > 1 && (value === null || typeof value !== "object")) {
        options = jQuery.extend({}, options);

        if (value === null) {
            options.expires = -1;
        }

        if (typeof options.expires === 'number') {
            var days = options.expires, t = options.expires = new Date();
            t.setDate(t.getDate() + days);
        }

        return (document.cookie = [
            encodeURIComponent(key), '=',
            options.raw ? String(value) : encodeURIComponent(String(value)),
            options.expires ? '; expires=' + options.expires.toUTCString() : '', // use expires attribute, max-age is not supported by IE
            options.path ? '; path=' + options.path : '',
            options.domain ? '; domain=' + options.domain : '',
            options.secure ? '; secure' : ''
        ].join(''));
    }

    // key and possibly options given, get cookie...
    options = value || {};
    var result, decode = options.raw ? function (s) { return s; } : decodeURIComponent;
    return (result = new RegExp('(?:^|; )' + encodeURIComponent(key) + '=([^;]*)').exec(document.cookie)) ? decode(result[1]) : null;
};

;/*})'"*/
;/*})'"*/
(function($) {

/**
 * jQuery debugging helper.
 *
 * Invented for Dreditor.
 *
 * @usage
 *   $.debug(var [, name]);
 *   $variable.debug( [name] );
 */
jQuery.extend({
  debug: function () {
    // Setup debug storage in global window. We want to look into it.
    window.debug = window.debug || [];

    args = jQuery.makeArray(arguments);
    // Determine data source; this is an object for $variable.debug().
    // Also determine the identifier to store data with.
    if (typeof this == 'object') {
      var name = (args.length ? args[0] : window.debug.length);
      var data = this;
    }
    else {
      var name = (args.length > 1 ? args.pop() : window.debug.length);
      var data = args[0];
    }
    // Store data.
    window.debug[name] = data;
    // Dump data into Firebug console.
    if (typeof console != 'undefined') {
      console.log(name, data);
    }
    return this;
  }
});
// @todo Is this the right way?
jQuery.fn.debug = jQuery.debug;

})(jQuery);

;/*})'"*/
;/*})'"*/
// $Id: contentanalysis.js,v 1.1.2.7 2010/11/09 21:50:14 tomdude48 Exp $
var contentanalysis = contentanalysis || {};

(function ($, $$) {
	$.extend($$, {
		contentanalysisPrevAnalyzerTab: '',
		contentanalysisPrevReportTab: '',
		contentanalysisCurrentAnalyzerTab: '',
		contentanalysisCurrentReportTab: '',
		contentanalysisReportActiveTab: {},
		
		init: function() {
			$$.contentanalysis_contentanalysisui();
		},
		
		contentanalysis_contentanalysisui: function() {
		    if($('#modalContent div.analyzers h3.analyzer').size() > 0) {
		        $$.contentanalysis_show_analyzer_tab($('div.analyzers h3.analyzer').get(0));
		        $('div.analyzers h3.analyzer').mousedown(function () {
		        	$$.contentanalysis_show_analyzer_tab(this);
		        }) 
		        $('h3.contentanalysis-report-tab').mousedown(function () { 
		        	$$.contentanalysis_show_report_tab(this);
		        })
		    }	
		},

		contentanalysis_back: function() {
			$$.contentanalysis_show_analyzer_tab(contentanalysisPrevAnalyzerTab);
		  //contentanalysis_show_report_tab(contentanalysisPrevReportTab);
		},

		contentanalysis_show_analyzer_tab: function (theTab){
		  $('div.analysis-results div.analyzer-analysis:eq(' + $('.analyzers h3.analyzer').index(theTab) + ')').children('.content-analysis-tab:first').addClass('active');
		  $('div.analysis-results div.analyzer-analysis').hide();
		  $('.analyzers h3.analyzer').removeClass('active');
		  $(theTab).addClass('active');
		  $('div.analysis-results div.analyzer-analysis:eq(' + $('.analyzers h3.analyzer').index(theTab) + ')').show();
		  $('.content-analysis-results').hide();
		
		  var id = $(theTab).attr('id');
		  var e = id.split('-');
		  var analyzer = e[3];
		  
		  if($$.contentanalysisReportActiveTab[analyzer]) {
		    $$.contentanalysis_show_report_tab($('#contentanalysis-report-tab-' + analyzer + '-' + $$.contentanalysisReportActiveTab[analyzer]));
		  }
		  else {
		    $$.contentanalysis_show_report_tab($('#contentanalysis-report-tab-' + analyzer + '-0'));
		  }
		  $$.contentanalysisPrevAnalyzerTab = $$.contentanalysisCurrentAnalyzerTab;
		  $$.contentanalysisCurrentAnalyzerTab = theTab;  
		},

		contentanalysis_show_report_tab: function (theTab){
		  var id = $(theTab).attr('id');
		  var e = id.split('-');
		  $$.contentanalysisReportActiveTab[e[3]] = e[4];
		  $('h3.contentanalysis-report-tab').removeClass('active');  
		  $(theTab).addClass('active');
		  $('.contentanalysis-results-section').hide();
		
		  var tabs = $("#contentanalysis-report-tabs-" + e[3]);
		  //tabs.css('border','2px solid red');
		  var pos = $("#contentanalysis-report-tabs-" + e[3]).position(); 
		  var offset = $("#contentanalysis-report-tabs-" + e[3]).offset(); 
		  var height = tabs.height();
		  var top = (pos.top+height)+"px";
		  var left = (pos.left)+"px";
		  
		  var sec_id = id.replace('tab', 'results');
		  var result_id = sec_id.replace('-'+e[4],'')
		  //$('#' + result_id).css({'top': top, 'left': left}); 
		  $('#' + result_id).css('top', top); 
		  //$('#' + result_id).css('border', '2px solid green'); 
		  $('#' + sec_id).show();
		//alert("pos.left="+pos.left+",pos.top="+pos.top+",offset.left="+offset.left+",offset.top="+offset.top);
		  $$.contentanalysisPrevReportTab = $$.contentanalysisCurrentReportTab;
		  $$.contentanalysisCurrentReportTab = theTab; 
		},

		// called from inline Analyze content button
		contentanalysis_inline_analysis: function() {
		  Drupal.settings.contentanalysis.display_dialog = 0;
		  Drupal.settings.contentanalysis.display_inline = 1;
		  //$('#contentanalysis-ininline-analysis-button').after('<span class="throbber">Loading...</span>');
		  //$('#contentanalysis-ininline-analysis-button').after(Drupal.settings.contentanalysis.throbber);
		  $('#contentanalysis-buttons').after('<div class="ahah-progress ahah-progress-throbber"><div class="throbber">&nbsp;</div><div class="message">' + Drupal.t('Analyzing...') + '</div></div>');
		  $$.contentanalysis_analyze();
		},

		// called from inline Analyze content button
		contentanalysis_dialog_analysis: function() {
		  Drupal.settings.contentanalysis.display_dialog = 1;
		  Drupal.settings.contentanalysis.display_inline = 0;
		  $$.contentanalysis_analyze();
		},

		// called from inline Analyze content button
		contentanalysis_full_analysis: function() {
		  Drupal.settings.contentanalysis.display_dialog = 1;
		  Drupal.settings.contentanalysis.display_inline = 1;
		  
		  $$.contentanalysis_analyze();
		},

		// called from inline Analyze content button
		contentanalysis_refresh_analysis: function(analyzer) {
		  Drupal.settings.contentanalysis.display_dialog = 0;
		  Drupal.settings.contentanalysis.display_inline = 1;
		  //$('.contentanalysis-refresh-link-' + analyzer).replaceWith('<span class="throbber">Loading...</span>');
		  $('.contentanalysis-refresh-link-' + analyzer).replaceWith('<div class="ahah-progress ahah-progress-throbber"><div class="throbber">&nbsp;</div></div>');
		  $$.contentanalysis_analyze(analyzer);
		},

		contentanalysis_analyze: function(analyzer_override) {
		  // if TinyMCE is used, turn off and on to save body text to textarea
		  var data = { 
		    'nid': -1,
		    'node_type': -1,
		    'source': -1,
		    'analyzers':-1,
		    'title': -1, 
		    'body': -1,
		    'body_summary': -1,
		    'page_title':-1, 
		    'meta_title':-1,
		    'meta_keywords':-1, 
		    'meta_description':-1,
		    'path_alias': -1,
		    'path_pathauto': -1,
		    'url': -1,
		    'page': -1,
		    'body_input_filter': -1,
		    'hidden': -1,    
		    'code': Drupal.settings.contentanalysis.code,
		    'action': -1
		  };
		  if(analyzer_override) {
		    data.action = 'refresh';
		  }
		  if ($('#contentanalysis-page-analyzer-form').html()) {
		    data.source = 'admin-form';
		    data.body = $('[name=input]').val()
		    data.nid = $('[name=input_nid]').val()
		    data.url = $('[name=input_url]').val()
		    if(data.body == '') {
		      data.body = -1;
		    }
		    if(data.nid == '') {
		      data.nid = -1;
		    }
		    if(data.url == '') {
		      data.url = -1;
		    }    
		  } else if ($('.node-form').html()) {
		    data.source = 'node-edit-form';
		    // Turn off TinyMCE if enabled
		    if(typeof tinyMCE == 'object') {
		    	tinyMCE.get('edit-body-und-0-value').hide();
		    }
		    // Turn off CKEditor if any.
		    var ckeditor = false;
		    if ($('#cke_edit-body-und-0-value').html()) {
		      $('#wysiwyg-toggle-edit-body-und-0-value').click();
		      ckeditor = true;
		    }
		
		    data.title = $('#edit-title').val();
		    data.body = $('#edit-body-und-0-value').val();
		    if ($('#edit-body-und-0-summary').val() != null) {
		      data.body_summary = $('#edit-body-und-0-summary').val();
		    } 
		    data.nid = Drupal.settings.contentanalysis.nid
		    data.node_type = Drupal.settings.contentanalysis.node_type
		    data.body_input_filter = $("select[name='body[und][0][format]'] option:selected").val();
		    
		    if ($('#edit-page-title').val() != null) {
		      data.page_title = $('#edit-page-title').val();
		    }    
		    // check if metatag module fields exist
		    if ($('#edit-metatags-title-value').val() != null) {
		      data.meta_title = $('#edit-metatags-title-value').val();
		    }
		    if ($('#edit-metatags-keywords-value').val() != null) {
		      data.meta_keywords = $('#edit-metatags-keywords-value').val();
		    }
		    if ($('#edit-metatags-description-value').val() != null) {
		      data.meta_description = $('#edit-metatags-description-value').val();
		    }
		    if ($('#edit-path-alias').val() != null) {
		      data.url = window.location.host + Drupal.settings.contentanalysis.base_path + $('#edit-path-alias').val();
		      data.path_alias = $('#edit-path-alias').val();
		    }
		    if ($("input[name='path[pathauto]']:checked").val() != null) {
		    	data.path_pathauto = 1;
		    }
		    // Turn back on tinyMCE
		    if(typeof tinyMCE == 'object') {
		    	tinyMCE.get('edit-body-und-0-value').show();
		    }	
		    // Turn back on CKEditor if needed.
		    if (ckeditor) {
		      $('#wysiwyg-toggle-edit-body-und-0-value').click();
		    }
		
		  } else {
		    data.source = 'page-link';
		    data.page = $('html').html()  
		    data.url = window.location.href
		  }
		  if(Drupal.settings.contentanalysis.hidden != null) {
		    data.hidden = Drupal.settings.contentanalysis.hidden;
		  }
		  
		  //alert('data.nid ' + data.nid)
		  var analyzers_arr = new Array();
		  if(analyzer_override) {
		    data.analyzers = analyzer_override;
		    analyzers_arr[0] = data.analyzers; 
		  }
		  else if($('#contentanalysis_analyzers_override input').val() != null) {    
		    data.analyzers = $('#contentanalysis_analyzers_override input').val();
		    analyzers_arr[0] = data.analyzers;
		  } 
		  else {
		    var i = 0;
		    $('#contentanalysis_analyzers .form-checkbox:checked').each ( function () {  
		      var expr = new RegExp(/\[[^\]]+\]/);
		      analyzers_arr[i] = expr.exec($(this).attr('name'))[0].replace(']', '').replace('[','');    
		      i++;
		    })
		    data.analyzers = analyzers_arr.join(',');
		  }
		  // call contentanalysis_data for enabed analyzers
		  for(var i in analyzers_arr) {
		    var aid = analyzers_arr[i];
		    var module = Drupal.settings.contentanalysis.analyzer_modules[aid].module;
		    if (eval('typeof ' + module + '_contentanalysis_data == "function"')) {
		      d = eval(module + '_contentanalysis_data')(aid, data);
		      for(var k in d) {
		        eval('data.ao_'+aid+'_'+k+' = "'+d[k]+'";');
		      }
		    }
		  }  
		  $('#contentanalysis-buttons').hide(); 
		  $.ajax({
		    type: 'POST',
		    url: Drupal.settings.contentanalysis.analyze_callback,
		    data: data,
		    dataType: 'json',
		    success: function(data, textStatus) {
		      analyzers_arr = data.inputs['analyzers'].split(",");
		      if(Drupal.settings.contentanalysis.display_dialog == 1) {
		        $('#analysis-modal').append(data.main['output']);
		        $('#analysis-modal .progress').remove();
		        //Drupal.behaviors.contentanalysisui();
		        $$.contentanalysis_contentanalysisui()
		      }
		      // display inline if enabled
		      if(Drupal.settings.contentanalysis.display_inline == 1) {
		        if(data.inputs['action'] == 'refresh') {
		          //if($('.contentanalysis_section_analysis').length > 0)
		          for(i in analyzers_arr) {
		            aid = analyzers_arr[i];
		            $('.contentanalysis-report-'+aid+'-page_title').replaceWith(data.page_title['output']);
		            $('.contentanalysis-report-'+aid+'-body').replaceWith(data.body['output']);
		            $('.contentanalysis-report-'+aid+'-meta_description').replaceWith(data.meta_description['output']);
		            $('.contentanalysis-report-'+aid+'-meta_keywords').replaceWith(data.meta_keywords['output']);
		          }
		        }
		        else {
		          var show_title = true;
		          if($('.form-item-metatags-title-value').length > 0) {
		            $('.form-item-metatags-title-value > .contentanalysis_section_analysis').remove();
		            $('.form-item-metatags-title-value').append(data.page_title['output']);
		            // check if metatag-title contains [node:title] token
		            if ($('#edit-metatags-title-value').val() != null) {
		              var meta_title = $('#edit-metatags-title-value').val();
		              if(meta_title.indexOf("[node:title]") == -1) {
		            	//show_title = false;
		              }
		            }
		          } 
		          if (show_title) {
		            $('.form-item-title > .contentanalysis_section_analysis').remove();
		            $('.form-item-title').append(data.page_title['output']);				
		          }
		    
		          $('#edit-body > .contentanalysis_section_analysis').remove();
		          $('#edit-body').append(data.body['output']);
		          // check newer nodewords format
		          if(($('.form-item-metatags-description-value').length > 0) && data.meta_description != null) {
		            $('.form-item-metatags-description-value > .contentanalysis_section_analysis').remove();
		            $('.form-item-metatags-description-value').append(data.meta_description['output']);
		          }
		          
		          if(($('.form-item-metatags-keywords-value').length > 0) && data.meta_keywords != null) {
		            $('.form-item-metatags-keywords-value > .contentanalysis_section_analysis').remove();
		            $('.form-item-metatags-keywords-value').append(data.meta_keywords['output']);
		          }
		        }
		        for(var i in analyzers_arr) {
		          var aid = analyzers_arr[i];
		          h = '<a href="#" class="contentanalysis-refresh-link-' + aid + '" onclick="contentanalysis.contentanalysis_refresh_analysis(\'' + aid + '\'); return false;">';
		          h += '<img src="' + Drupal.settings.contentanalysis.path_to_module + '/icons/refresh.png" alt="refresh" />';
		          h += '</a>';
		          $('.contentanalysis-report-' + aid + ' label').append(h);
		        } 
					}      
		      // call any modules post analysis hooks      
		      for(var i in analyzers_arr) {
		        var aid = analyzers_arr[i];        
		        var module = Drupal.settings.contentanalysis.analyzer_modules[aid].module;     
		        if (eval('typeof ' + module + '_contentanalysis_analysis_success == "function"')) {
		          eval(module + '_contentanalysis_analysis_success')(aid, data);
		        }
		      } 
		      if(typeof Drupal.behaviors.collapse == 'function') {
		    	  Drupal.behaviors.collapse();  
		      }
		      $('.ahah-progress-throbber').remove();
		      $('#contentanalysis-buttons').show();
		    },
		    error: function(xhr, status) {
		      alert(xhr.responseText.toString());
		      $('.ahah-progress-throbber').remove();
		      $('#contentanalysis-buttons').show();
		    }
		  });
		  return false;	
		}
	});	

	Drupal.behaviors.contentanalysisui = {
	  attach: function (context, settings) {
		$$.init();
	  }
	};
	
	Sliders = {};
	
	Sliders.changeHandle = function(e,ui) {
	  var id = jQuery(ui.handle).parents('div.slider-widget-container').attr('id');
	  if (typeof(ui.values) != 'undefined') {
	    jQuery.each(ui.values, function(i,val) {
	      jQuery("#"+id+"_value_"+i).val(val);
	      jQuery("#"+id+"_nr_"+i).text(val);
	    });
	  } else {
	    jQuery("#"+id+"_value_0").val(ui.value);
	    jQuery("#"+id+"_nr_0").text(ui.value);
	  }
	};

})(jQuery, contentanalysis);

;/*})'"*/
;/*})'"*/
var contentoptimizer_contentanalysis_data = function(aid) {		
  data = new Array();	
  data['keyword'] = document.getElementById('edit-seo-keyword').value;	
  return data;
}
;/*})'"*/
;/*})'"*/
/*!
	Colorbox v1.4.33 - 2013-10-31
	jQuery lightbox and modal window plugin
	(c) 2013 Jack Moore - http://www.jacklmoore.com/colorbox
	license: http://www.opensource.org/licenses/mit-license.php
*/
(function(e,t,i){function o(i,o,n){var r=t.createElement(i);return o&&(r.id=Z+o),n&&(r.style.cssText=n),e(r)}function n(){return i.innerHeight?i.innerHeight:e(i).height()}function r(e){var t=k.length,i=(z+e)%t;return 0>i?t+i:i}function h(e,t){return Math.round((/%/.test(e)?("x"===t?E.width():n())/100:1)*parseInt(e,10))}function l(e,t){return e.photo||e.photoRegex.test(t)}function s(e,t){return e.retinaUrl&&i.devicePixelRatio>1?t.replace(e.photoRegex,e.retinaSuffix):t}function a(e){"contains"in g[0]&&!g[0].contains(e.target)&&(e.stopPropagation(),g.focus())}function d(){var t,i=e.data(N,Y);null==i?(B=e.extend({},X),console&&console.log&&console.log("Error: cboxElement missing settings object")):B=e.extend({},i);for(t in B)e.isFunction(B[t])&&"on"!==t.slice(0,2)&&(B[t]=B[t].call(N));B.rel=B.rel||N.rel||e(N).data("rel")||"nofollow",B.href=B.href||e(N).attr("href"),B.title=B.title||N.title,"string"==typeof B.href&&(B.href=e.trim(B.href))}function c(i,o){e(t).trigger(i),lt.triggerHandler(i),e.isFunction(o)&&o.call(N)}function u(i){q||(N=i,d(),k=e(N),z=0,"nofollow"!==B.rel&&(k=e("."+et).filter(function(){var t,i=e.data(this,Y);return i&&(t=e(this).data("rel")||i.rel||this.rel),t===B.rel}),z=k.index(N),-1===z&&(k=k.add(N),z=k.length-1)),w.css({opacity:parseFloat(B.opacity),cursor:B.overlayClose?"pointer":"auto",visibility:"visible"}).show(),J&&g.add(w).removeClass(J),B.className&&g.add(w).addClass(B.className),J=B.className,B.closeButton?K.html(B.close).appendTo(y):K.appendTo("<div/>"),U||(U=$=!0,g.css({visibility:"hidden",display:"block"}),H=o(st,"LoadedContent","width:0; height:0; overflow:hidden"),y.css({width:"",height:""}).append(H),O=x.height()+C.height()+y.outerHeight(!0)-y.height(),_=b.width()+T.width()+y.outerWidth(!0)-y.width(),D=H.outerHeight(!0),A=H.outerWidth(!0),B.w=h(B.initialWidth,"x"),B.h=h(B.initialHeight,"y"),H.css({width:"",height:B.h}),Q.position(),c(tt,B.onOpen),P.add(L).hide(),g.focus(),B.trapFocus&&t.addEventListener&&(t.addEventListener("focus",a,!0),lt.one(rt,function(){t.removeEventListener("focus",a,!0)})),B.returnFocus&&lt.one(rt,function(){e(N).focus()})),m())}function f(){!g&&t.body&&(V=!1,E=e(i),g=o(st).attr({id:Y,"class":e.support.opacity===!1?Z+"IE":"",role:"dialog",tabindex:"-1"}).hide(),w=o(st,"Overlay").hide(),F=e([o(st,"LoadingOverlay")[0],o(st,"LoadingGraphic")[0]]),v=o(st,"Wrapper"),y=o(st,"Content").append(L=o(st,"Title"),S=o(st,"Current"),I=e('<button type="button"/>').attr({id:Z+"Previous"}),R=e('<button type="button"/>').attr({id:Z+"Next"}),M=o("button","Slideshow"),F),K=e('<button type="button"/>').attr({id:Z+"Close"}),v.append(o(st).append(o(st,"TopLeft"),x=o(st,"TopCenter"),o(st,"TopRight")),o(st,!1,"clear:left").append(b=o(st,"MiddleLeft"),y,T=o(st,"MiddleRight")),o(st,!1,"clear:left").append(o(st,"BottomLeft"),C=o(st,"BottomCenter"),o(st,"BottomRight"))).find("div div").css({"float":"left"}),W=o(st,!1,"position:absolute; width:9999px; visibility:hidden; display:none; max-width:none;"),P=R.add(I).add(S).add(M),e(t.body).append(w,g.append(v,W)))}function p(){function i(e){e.which>1||e.shiftKey||e.altKey||e.metaKey||e.ctrlKey||(e.preventDefault(),u(this))}return g?(V||(V=!0,R.click(function(){Q.next()}),I.click(function(){Q.prev()}),K.click(function(){Q.close()}),w.click(function(){B.overlayClose&&Q.close()}),e(t).bind("keydown."+Z,function(e){var t=e.keyCode;U&&B.escKey&&27===t&&(e.preventDefault(),Q.close()),U&&B.arrowKey&&k[1]&&!e.altKey&&(37===t?(e.preventDefault(),I.click()):39===t&&(e.preventDefault(),R.click()))}),e.isFunction(e.fn.on)?e(t).on("click."+Z,"."+et,i):e("."+et).live("click."+Z,i)),!0):!1}function m(){var n,r,a,u=Q.prep,f=++at;$=!0,j=!1,N=k[z],d(),c(ht),c(it,B.onLoad),B.h=B.height?h(B.height,"y")-D-O:B.innerHeight&&h(B.innerHeight,"y"),B.w=B.width?h(B.width,"x")-A-_:B.innerWidth&&h(B.innerWidth,"x"),B.mw=B.w,B.mh=B.h,B.maxWidth&&(B.mw=h(B.maxWidth,"x")-A-_,B.mw=B.w&&B.w<B.mw?B.w:B.mw),B.maxHeight&&(B.mh=h(B.maxHeight,"y")-D-O,B.mh=B.h&&B.h<B.mh?B.h:B.mh),n=B.href,G=setTimeout(function(){F.show()},100),B.inline?(a=o(st).hide().insertBefore(e(n)[0]),lt.one(ht,function(){a.replaceWith(H.children())}),u(e(n))):B.iframe?u(" "):B.html?u(B.html):l(B,n)?(n=s(B,n),j=t.createElement("img"),e(j).addClass(Z+"Photo").bind("error",function(){B.title=!1,u(o(st,"Error").html(B.imgError))}).one("load",function(){var t;f===at&&(e.each(["alt","longdesc","aria-describedby"],function(t,i){var o=e(N).attr(i)||e(N).attr("data-"+i);o&&j.setAttribute(i,o)}),B.retinaImage&&i.devicePixelRatio>1&&(j.height=j.height/i.devicePixelRatio,j.width=j.width/i.devicePixelRatio),B.scalePhotos&&(r=function(){j.height-=j.height*t,j.width-=j.width*t},B.mw&&j.width>B.mw&&(t=(j.width-B.mw)/j.width,r()),B.mh&&j.height>B.mh&&(t=(j.height-B.mh)/j.height,r())),B.h&&(j.style.marginTop=Math.max(B.mh-j.height,0)/2+"px"),k[1]&&(B.loop||k[z+1])&&(j.style.cursor="pointer",j.onclick=function(){Q.next()}),j.style.width=j.width+"px",j.style.height=j.height+"px",setTimeout(function(){u(j)},1))}),setTimeout(function(){j.src=n},1)):n&&W.load(n,B.data,function(t,i){f===at&&u("error"===i?o(st,"Error").html(B.xhrError):e(this).contents())})}var w,g,v,y,x,b,T,C,k,E,H,W,F,L,S,M,R,I,K,P,B,O,_,D,A,N,z,j,U,$,q,G,Q,J,V,X={html:!1,photo:!1,iframe:!1,inline:!1,transition:"elastic",speed:300,fadeOut:300,width:!1,initialWidth:"600",innerWidth:!1,maxWidth:!1,height:!1,initialHeight:"450",innerHeight:!1,maxHeight:!1,scalePhotos:!0,scrolling:!0,href:!1,title:!1,rel:!1,opacity:.9,preloading:!0,className:!1,overlayClose:!0,escKey:!0,arrowKey:!0,top:!1,bottom:!1,left:!1,right:!1,fixed:!1,data:void 0,closeButton:!0,fastIframe:!0,open:!1,reposition:!0,loop:!0,slideshow:!1,slideshowAuto:!0,slideshowSpeed:2500,slideshowStart:"start slideshow",slideshowStop:"stop slideshow",photoRegex:/\.(gif|png|jp(e|g|eg)|bmp|ico|webp)((#|\?).*)?$/i,retinaImage:!1,retinaUrl:!1,retinaSuffix:"@2x.$1",current:"image {current} of {total}",previous:"previous",next:"next",close:"close",xhrError:"This content failed to load.",imgError:"This image failed to load.",returnFocus:!0,trapFocus:!0,onOpen:!1,onLoad:!1,onComplete:!1,onCleanup:!1,onClosed:!1},Y="colorbox",Z="cbox",et=Z+"Element",tt=Z+"_open",it=Z+"_load",ot=Z+"_complete",nt=Z+"_cleanup",rt=Z+"_closed",ht=Z+"_purge",lt=e("<a/>"),st="div",at=0,dt={},ct=function(){function e(){clearTimeout(h)}function t(){(B.loop||k[z+1])&&(e(),h=setTimeout(Q.next,B.slideshowSpeed))}function i(){M.html(B.slideshowStop).unbind(s).one(s,o),lt.bind(ot,t).bind(it,e),g.removeClass(l+"off").addClass(l+"on")}function o(){e(),lt.unbind(ot,t).unbind(it,e),M.html(B.slideshowStart).unbind(s).one(s,function(){Q.next(),i()}),g.removeClass(l+"on").addClass(l+"off")}function n(){r=!1,M.hide(),e(),lt.unbind(ot,t).unbind(it,e),g.removeClass(l+"off "+l+"on")}var r,h,l=Z+"Slideshow_",s="click."+Z;return function(){r?B.slideshow||(lt.unbind(nt,n),n()):B.slideshow&&k[1]&&(r=!0,lt.one(nt,n),B.slideshowAuto?i():o(),M.show())}}();e.colorbox||(e(f),Q=e.fn[Y]=e[Y]=function(t,i){var o=this;if(t=t||{},f(),p()){if(e.isFunction(o))o=e("<a/>"),t.open=!0;else if(!o[0])return o;i&&(t.onComplete=i),o.each(function(){e.data(this,Y,e.extend({},e.data(this,Y)||X,t))}).addClass(et),(e.isFunction(t.open)&&t.open.call(o)||t.open)&&u(o[0])}return o},Q.position=function(t,i){function o(){x[0].style.width=C[0].style.width=y[0].style.width=parseInt(g[0].style.width,10)-_+"px",y[0].style.height=b[0].style.height=T[0].style.height=parseInt(g[0].style.height,10)-O+"px"}var r,l,s,a=0,d=0,c=g.offset();if(E.unbind("resize."+Z),g.css({top:-9e4,left:-9e4}),l=E.scrollTop(),s=E.scrollLeft(),B.fixed?(c.top-=l,c.left-=s,g.css({position:"fixed"})):(a=l,d=s,g.css({position:"absolute"})),d+=B.right!==!1?Math.max(E.width()-B.w-A-_-h(B.right,"x"),0):B.left!==!1?h(B.left,"x"):Math.round(Math.max(E.width()-B.w-A-_,0)/2),a+=B.bottom!==!1?Math.max(n()-B.h-D-O-h(B.bottom,"y"),0):B.top!==!1?h(B.top,"y"):Math.round(Math.max(n()-B.h-D-O,0)/2),g.css({top:c.top,left:c.left,visibility:"visible"}),v[0].style.width=v[0].style.height="9999px",r={width:B.w+A+_,height:B.h+D+O,top:a,left:d},t){var u=0;e.each(r,function(e){return r[e]!==dt[e]?(u=t,void 0):void 0}),t=u}dt=r,t||g.css(r),g.dequeue().animate(r,{duration:t||0,complete:function(){o(),$=!1,v[0].style.width=B.w+A+_+"px",v[0].style.height=B.h+D+O+"px",B.reposition&&setTimeout(function(){E.bind("resize."+Z,Q.position)},1),i&&i()},step:o})},Q.resize=function(e){var t;U&&(e=e||{},e.width&&(B.w=h(e.width,"x")-A-_),e.innerWidth&&(B.w=h(e.innerWidth,"x")),H.css({width:B.w}),e.height&&(B.h=h(e.height,"y")-D-O),e.innerHeight&&(B.h=h(e.innerHeight,"y")),e.innerHeight||e.height||(t=H.scrollTop(),H.css({height:"auto"}),B.h=H.height()),H.css({height:B.h}),t&&H.scrollTop(t),Q.position("none"===B.transition?0:B.speed))},Q.prep=function(i){function n(){return B.w=B.w||H.width(),B.w=B.mw&&B.mw<B.w?B.mw:B.w,B.w}function h(){return B.h=B.h||H.height(),B.h=B.mh&&B.mh<B.h?B.mh:B.h,B.h}if(U){var a,d="none"===B.transition?0:B.speed;H.empty().remove(),H=o(st,"LoadedContent").append(i),H.hide().appendTo(W.show()).css({width:n(),overflow:B.scrolling?"auto":"hidden"}).css({height:h()}).prependTo(y),W.hide(),e(j).css({"float":"none"}),a=function(){function i(){e.support.opacity===!1&&g[0].style.removeAttribute("filter")}var n,h,a=k.length,u="frameBorder",f="allowTransparency";U&&(h=function(){clearTimeout(G),F.hide(),c(ot,B.onComplete)},L.html(B.title).add(H).show(),a>1?("string"==typeof B.current&&S.html(B.current.replace("{current}",z+1).replace("{total}",a)).show(),R[B.loop||a-1>z?"show":"hide"]().html(B.next),I[B.loop||z?"show":"hide"]().html(B.previous),ct(),B.preloading&&e.each([r(-1),r(1)],function(){var i,o,n=k[this],r=e.data(n,Y);r&&r.href?(i=r.href,e.isFunction(i)&&(i=i.call(n))):i=e(n).attr("href"),i&&l(r,i)&&(i=s(r,i),o=t.createElement("img"),o.src=i)})):P.hide(),B.iframe?(n=o("iframe")[0],u in n&&(n[u]=0),f in n&&(n[f]="true"),B.scrolling||(n.scrolling="no"),e(n).attr({src:B.href,name:(new Date).getTime(),"class":Z+"Iframe",allowFullScreen:!0,webkitAllowFullScreen:!0,mozallowfullscreen:!0}).one("load",h).appendTo(H),lt.one(ht,function(){n.src="//about:blank"}),B.fastIframe&&e(n).trigger("load")):h(),"fade"===B.transition?g.fadeTo(d,1,i):i())},"fade"===B.transition?g.fadeTo(d,0,function(){Q.position(0,a)}):Q.position(d,a)}},Q.next=function(){!$&&k[1]&&(B.loop||k[z+1])&&(z=r(1),u(k[z]))},Q.prev=function(){!$&&k[1]&&(B.loop||z)&&(z=r(-1),u(k[z]))},Q.close=function(){U&&!q&&(q=!0,U=!1,c(nt,B.onCleanup),E.unbind("."+Z),w.fadeTo(B.fadeOut||0,0),g.stop().fadeTo(B.fadeOut||0,0,function(){g.add(w).css({opacity:1,cursor:"auto"}).hide(),c(ht),H.empty().remove(),setTimeout(function(){q=!1,c(rt,B.onClosed)},1)}))},Q.remove=function(){g&&(g.stop(),e.colorbox.close(),g.stop().remove(),w.remove(),q=!1,g=null,e("."+et).removeData(Y).removeClass(et),e(t).unbind("click."+Z))},Q.element=function(){return e(N)},Q.settings=X)})(jQuery,document,window);
;/*})'"*/
;/*})'"*/
/**
 * @file
 * Colorbox module init js.
 */

(function ($) {

Drupal.behaviors.initColorbox = {
  attach: function (context, settings) {
    if (!$.isFunction($.colorbox) || typeof settings.colorbox === 'undefined') {
      return;
    }

    if (settings.colorbox.mobiledetect && window.matchMedia) {
      // Disable Colorbox for small screens.
      var mq = window.matchMedia("(max-device-width: " + settings.colorbox.mobiledevicewidth + ")");
      if (mq.matches) {
        return;
      }
    }

    // Use "data-colorbox-gallery" if set otherwise use "rel".
    settings.colorbox.rel = function () {
      if ($(this).data('colorbox-gallery')) {
        return $(this).data('colorbox-gallery');
      }
      else {
        return $(this).attr('rel');
      }
    };

    $('.colorbox', context)
      .once('init-colorbox')
      .colorbox(settings.colorbox);

    $(context).bind('cbox_complete', function () {
      Drupal.attachBehaviors('#cboxLoadedContent');
    });
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
/**
 * @file
 * Colorbox module style js.
 */

(function ($) {

Drupal.behaviors.initColorboxDefaultStyle = {
  attach: function (context, settings) {
    $(context).bind('cbox_complete', function () {
      // Only run if there is a title.
      if ($('#cboxTitle:empty', context).length == false) {
        $('#cboxLoadedContent img', context).bind('mouseover', function () {
          $('#cboxTitle', context).slideDown();
        });
        $('#cboxOverlay', context).bind('mouseover', function () {
          $('#cboxTitle', context).slideUp();
        });
      }
      else {
        $('#cboxTitle', context).hide();
      }
    });
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
/**
 * @file
 * Colorbox module load js.
 */
(function ($) {

Drupal.behaviors.initColorboxLoad = {
  attach: function (context, settings) {
    if (!$.isFunction($.colorbox) || typeof settings.colorbox === 'undefined') {
      return;
    }

    if (settings.colorbox.mobiledetect && window.matchMedia) {
      // Disable Colorbox for small screens.
      var mq = window.matchMedia("(max-device-width: " + settings.colorbox.mobiledevicewidth + ")");
      if (mq.matches) {
        return;
      }
    }

    $.urlParams = function (url) {

      var p = {},
          e,
          a = /\+/g,  // Regex for replacing addition symbol with a space.
          r = /([^&=]+)=?([^&]*)/g,
          d = function (s) { return decodeURIComponent(s.replace(a, ' ')); },
          q = url.split('?');
      while (e = r.exec(q[1])) {
        e[1] = d(e[1]);
        e[2] = d(e[2]);
        switch (e[2].toLowerCase()) {
          case 'true':
          case 'yes':
            e[2] = true;
            break;
          case 'false':
          case 'no':
            e[2] = false;
            break;
        }
        if (e[1] == 'width') { e[1] = 'innerWidth'; }
        if (e[1] == 'height') { e[1] = 'innerHeight'; }
        p[e[1]] = e[2];
      }
      return p;
    };
    $('.colorbox-load', context)
      .once('init-colorbox-load', function () {
        var params = $.urlParams($(this).attr('href'));
        $(this).colorbox($.extend({}, settings.colorbox, params));
      });
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
/**
 * @file
 * Colorbox module inline js.
 */

(function ($) {

Drupal.behaviors.initColorboxInline = {
  attach: function (context, settings) {
    if (!$.isFunction($.colorbox) || typeof settings.colorbox === 'undefined') {
      return;
    }

    if (settings.colorbox.mobiledetect && window.matchMedia) {
      // Disable Colorbox for small screens.
      var mq = window.matchMedia("(max-device-width: " + settings.colorbox.mobiledevicewidth + ")");
      if (mq.matches) {
        return;
      }
    }

    $.urlParam = function(name, url){
      if (name == 'fragment') {
        var results = new RegExp('(#[^&#]*)').exec(url);
      }
      else {
        var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(url);
      }
      if (!results) { return ''; }
      return results[1] || '';
    };
    $('.colorbox-inline', context).once('init-colorbox-inline').colorbox({
      transition:settings.colorbox.transition,
      speed:settings.colorbox.speed,
      opacity:settings.colorbox.opacity,
      slideshow:settings.colorbox.slideshow,
      slideshowAuto:settings.colorbox.slideshowAuto,
      slideshowSpeed:settings.colorbox.slideshowSpeed,
      slideshowStart:settings.colorbox.slideshowStart,
      slideshowStop:settings.colorbox.slideshowStop,
      current:settings.colorbox.current,
      previous:settings.colorbox.previous,
      next:settings.colorbox.next,
      close:settings.colorbox.close,
      overlayClose:settings.colorbox.overlayClose,
      maxWidth:settings.colorbox.maxWidth,
      maxHeight:settings.colorbox.maxHeight,
      innerWidth:function(){
        return $.urlParam('width', $(this).attr('href'));
      },
      innerHeight:function(){
        return $.urlParam('height', $(this).attr('href'));
      },
      title:function(){
        return decodeURIComponent($.urlParam('title', $(this).attr('href')));
      },
      iframe:function(){
        return $.urlParam('iframe', $(this).attr('href'));
      },
      inline:function(){
        return $.urlParam('inline', $(this).attr('href'));
      },
      href:function(){
        return $.urlParam('fragment', $(this).attr('href'));
      }
    });
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
(function(cookieName, domain){

    var traffic_source_COOKIE_TOKEN_SEPARATOR = ">>"; //separating between concatenated lead source
    var traffic_source_date_SEPARATOR = "|>";
    var NONE = "(none)";

    domain = domain || window.location.hostname;

    function getCookie(cookieName){
        var name = cookieName + "=";
        var cookieArray = document.cookie.split(';'); //break cookie into array
        for(var i = 0; i < cookieArray.length; i++){
          var cookie = cookieArray[i].replace(/^\s+|\s+$/g, ''); //replace all space with '' = delete it
          if (cookie.indexOf(name)==0){
             return cookie.substring(name.length,cookie.length); //
          }
        }
        return null;
    }

/*
*  Takes the current time of the session, and optional addition to the traffic source. 
*  The output will be of the format: >>{traffic source}|>DD-MM-YY HH:MM AM/PM>>
*
*/

/*
*   Uncomment currTime() in order to activate. You should also uncomment the lines in the code that call this function (all marked with a comment). If you do so, uncomment the line above them which does not employ currTime()


	function currTime() {
	    var date = new Date();
	    var currDate = date.getDate();
	    var hours = date.getHours();
	    var minutes = date.getMinutes();
	    var month = date.getMonth() + 1;
	    var year = date.getFullYear();
	    var ampm = hours >= 12 ? 'pm' : 'am';
	    hours = hours % 12;
	    hours = hours ? hours : 12; // the hour '0' makes '12'
	    minutes = minutes < 10 ? '0' + minutes : minutes;
	    var strTime = traffic_source_date_SEPARATOR + currDate + '-' + month + '-' + year + ' ' + hours + ':' + minutes + ' ' + ampm + ')';
	    return strTime;
	}

*/

	/*
       Checks whether a certain parameter exist in the current browser URL. If it does, it returns its name. 
	   It will receive "src" later in the main function
    */
	
    function getURLParameter(param){
        var pageURL = window.location.search.substring(1); //get the query string parameters without the "?"
        var URLVariables = pageURL.split('&'); //break the parameters and values attached together to an array
        for (var i = 0; i < URLVariables.length; i++) {
            var parameterName = URLVariables[i].split('='); //break the parameters from the values
            if (parameterName[0] == param) {
                return parameterName[1];
            }
        }
        return null;
    }

	/*
       Gets the first (latest) token from a cookie: THIS__ONE>>NOT__THIS__ONE>>AND__NOT__THIS__ONE
    */
	
    function getFirstTokenFromCookie(cookie){
        var result = "";
        var firstSeparatorIndex = cookie.indexOf(traffic_source_COOKIE_TOKEN_SEPARATOR);
        result = firstSeparatorIndex !== -1 ? cookie.substring(0, firstSeparatorIndex) : cookie; //if there is a separator, provide the newest value no the cookie  
        return result;
    }

	/*
       Set the cookie if it doesn't exist.
    */
	
    function setCookie(cookie, value){
        var expires = new Date();
        expires.setTime(expires.getTime() + 62208000000); //1000*60*60*24*30*24 (2 years)
        document.cookie = cookie + "=" + value + "; expires=" + expires.toGMTString() + "; domain=" + domain + "; path=/";
    }
	
	/*
       Boolean, whether or not it's not NULL or Empty
    */
	
    function isNotNullOrEmpty(string){
        return string !== null && string !== "";
    }
	
	/*
       Remove the protocol for the referral token
    */
    function removeProtocol(href) {
        return href.replace(/.*?:\/\//g, "");
    }

    /*
       Find lead source by checking cookie, url param "src" or referrer(that order) and set new cookie traffic_source.
       Do this only if cookie do not exist. This value will be used for contact form.
       If cookie exist add url "src" param on the beginning of the cookie if it exists and it is not already at the beginning of the cookie.
       This way "tokens" are made in traffic_source cookie. Token separator is ">>" (see above traffic_source_COOKIE_TOKEN_SEPARATOR)
    */

    var urlParamSRC = getURLParameter("src"); //take the SRC value
    if(document.cookie.indexOf(cookieName) === -1) { // if there is no cookie traffic_source set yet, check if there is an existing UTMZ campaign name.
        var traffic_source = ""; //reset lead source value
        var utmzCookie = getCookie("__utmz"); //get GA cookie
        var cookieCampaignName = "";  //reset lead source value
        if(utmzCookie != null) {
            var UTMSRC = "utmccn=";
            var start = utmzCookie.indexOf(UTMSRC);
            var end = utmzCookie.indexOf("|", start); 
            if(start > -1) {
                if(end === -1) {
                    end = utmzCookie.length; 
                }
                cookieCampaignName = "utmz:" + utmzCookie.substring((start + UTMSRC.length), end); //get the value of the UTMZ, without the parameter name
            }
        }
        if(cookieCampaignName != "" && isNotNullOrEmpty(urlParamSRC)){ //if there is a campaign name AND there is SRC value
             traffic_source = urlParamSRC + traffic_source_COOKIE_TOKEN_SEPARATOR + cookieCampaignName; //concateane the SRC with the existing campaign name
             // traffic_source = urlParamSRC + currTime() + traffic_source_COOKIE_TOKEN_SEPARATOR + cookieCampaignName; // Optional: add the session time
        } else if(cookieCampaignName != ""){ //if there is campaign name
             traffic_source = cookieCampaignName;  //just use it for the new cookie
        } else if(urlParamSRC != null) { //if there is not campaign name but we have SRC
            traffic_source = decodeURI(urlParamSRC); // decode URI of the SRC parameter
            // traffic_source = decodeURI(urlParamSRC) + currTime(); //  Optional: add the session time
        } else if(document.referrer != ""){ //if there is not campaign, and no src, check if there is a referrer,
            var referrerHostName = removeProtocol(document.referrer);
            var GOOGLE = /www.google/; 
            var YAHOO = /search.yahoo/; 
            var BING = /www.bing/; 
            if(GOOGLE.test(referrerHostName)){
                traffic_source = "Google Search";
                //traffic_source = "Google Search" + currTime(); // + Optional: Add the current session time. Choose one of them.
            } else if(YAHOO.test(referrerHostName)){
                traffic_source = "Yahoo Search";
                //traffic_source = "Yahoo Search" + currTime();
            } else if(BING.test(referrerHostName)){
                traffic_source = "Bing Search";
                //traffic_source = "Bing Search" + currTime();
            } else {
                traffic_source = referrerHostName;
                //traffic_source = referrerHostName + currTime();
            }
        } else {
            traffic_source = NONE;
        }
        setCookie(cookieName, traffic_source); //set the cookie
		
    } else if(isNotNullOrEmpty(urlParamSRC)){ //if there is a cookie, add the SRC to the cookie, unless the same src already exists as the first token.
        var firstToken = getFirstTokenFromCookie(getCookie(cookieName));
        if(firstToken !== "" && urlParamSRC !== firstToken) {
            var newTrafficSourceCookie = urlParamSRC + traffic_source_COOKIE_TOKEN_SEPARATOR + getCookie(cookieName); //concetenate new SRC with old cookie values
            // var newTrafficSourceCookie = urlParamSRC + currTime() + traffic_source_COOKIE_TOKEN_SEPARATOR + getCookie(cookieName); // Optional: add the time of current session
            setCookie(cookieName, newTrafficSourceCookie);
        }
    }

 })("traffic_source", ".iphonelife.com");

;/*})'"*/
;/*})'"*/
(function ($) {
  Drupal.behaviors.iphonelifeTracking = {
    attach: function (context, settings) {
      url = new URL(window.location.href);

      for(var key of url.searchParams.keys()) {
        if(key.indexOf('t_') !== -1) {
          // if the url parameter starts with 't_'
          cookieValue = key + '=' + url.searchParams.get(key);
          // console.log("set cookie: " + cookieValue);
          document.cookie = cookieValue + '; domain=iphonelife.com; max-age=172800; path=/';
        }
      }
    }
  };
}(jQuery));

;/*})'"*/
;/*})'"*/
// Magnific Popup v1.0.0 by Dmitry Semenov
// http://bit.ly/magnific-popup#build=inline+ajax+iframe+gallery+retina
(function(a){typeof define=="function"&&define.amd?define(["jquery"],a):typeof exports=="object"?a(require("jquery")):a(window.jQuery||window.Zepto)})(function(a){var b="Close",c="BeforeClose",d="AfterClose",e="BeforeAppend",f="MarkupParse",g="Open",h="Change",i="mfp",j="."+i,k="mfp-ready",l="mfp-removing",m="mfp-prevent-close",n,o=function(){},p=!!window.jQuery,q,r=a(window),s,t,u,v,w=function(a,b){n.ev.on(i+a+j,b)},x=function(b,c,d,e){var f=document.createElement("div");return f.className="mfp-"+b,d&&(f.innerHTML=d),e?c&&c.appendChild(f):(f=a(f),c&&f.appendTo(c)),f},y=function(b,c){n.ev.triggerHandler(i+b,c),n.st.callbacks&&(b=b.charAt(0).toLowerCase()+b.slice(1),n.st.callbacks[b]&&n.st.callbacks[b].apply(n,a.isArray(c)?c:[c]))},z=function(b){if(b!==v||!n.currTemplate.closeBtn)n.currTemplate.closeBtn=a(n.st.closeMarkup.replace("%title%",n.st.tClose)),v=b;return n.currTemplate.closeBtn},A=function(){a.magnificPopup.instance||(n=new o,n.init(),a.magnificPopup.instance=n)},B=function(){var a=document.createElement("p").style,b=["ms","O","Moz","Webkit"];if(a.transition!==undefined)return!0;while(b.length)if(b.pop()+"Transition"in a)return!0;return!1};o.prototype={constructor:o,init:function(){var b=navigator.appVersion;n.isIE7=b.indexOf("MSIE 7.")!==-1,n.isIE8=b.indexOf("MSIE 8.")!==-1,n.isLowIE=n.isIE7||n.isIE8,n.isAndroid=/android/gi.test(b),n.isIOS=/iphone|ipad|ipod/gi.test(b),n.supportsTransition=B(),n.probablyMobile=n.isAndroid||n.isIOS||/(Opera Mini)|Kindle|webOS|BlackBerry|(Opera Mobi)|(Windows Phone)|IEMobile/i.test(navigator.userAgent),s=a(document),n.popupsCache={}},open:function(b){var c;if(b.isObj===!1){n.items=b.items.toArray(),n.index=0;var d=b.items,e;for(c=0;c<d.length;c++){e=d[c],e.parsed&&(e=e.el[0]);if(e===b.el[0]){n.index=c;break}}}else n.items=a.isArray(b.items)?b.items:[b.items],n.index=b.index||0;if(n.isOpen){n.updateItemHTML();return}n.types=[],u="",b.mainEl&&b.mainEl.length?n.ev=b.mainEl.eq(0):n.ev=s,b.key?(n.popupsCache[b.key]||(n.popupsCache[b.key]={}),n.currTemplate=n.popupsCache[b.key]):n.currTemplate={},n.st=a.extend(!0,{},a.magnificPopup.defaults,b),n.fixedContentPos=n.st.fixedContentPos==="auto"?!n.probablyMobile:n.st.fixedContentPos,n.st.modal&&(n.st.closeOnContentClick=!1,n.st.closeOnBgClick=!1,n.st.showCloseBtn=!1,n.st.enableEscapeKey=!1),n.bgOverlay||(n.bgOverlay=x("bg").on("click"+j,function(){n.close()}),n.wrap=x("wrap").attr("tabindex",-1).on("click"+j,function(a){n._checkIfClose(a.target)&&n.close()}),n.container=x("container",n.wrap)),n.contentContainer=x("content"),n.st.preloader&&(n.preloader=x("preloader",n.container,n.st.tLoading));var h=a.magnificPopup.modules;for(c=0;c<h.length;c++){var i=h[c];i=i.charAt(0).toUpperCase()+i.slice(1),n["init"+i].call(n)}y("BeforeOpen"),n.st.showCloseBtn&&(n.st.closeBtnInside?(w(f,function(a,b,c,d){c.close_replaceWith=z(d.type)}),u+=" mfp-close-btn-in"):n.wrap.append(z())),n.st.alignTop&&(u+=" mfp-align-top"),n.fixedContentPos?n.wrap.css({overflow:n.st.overflowY,overflowX:"hidden",overflowY:n.st.overflowY}):n.wrap.css({top:r.scrollTop(),position:"absolute"}),(n.st.fixedBgPos===!1||n.st.fixedBgPos==="auto"&&!n.fixedContentPos)&&n.bgOverlay.css({height:s.height(),position:"absolute"}),n.st.enableEscapeKey&&s.on("keyup"+j,function(a){a.keyCode===27&&n.close()}),r.on("resize"+j,function(){n.updateSize()}),n.st.closeOnContentClick||(u+=" mfp-auto-cursor"),u&&n.wrap.addClass(u);var l=n.wH=r.height(),m={};if(n.fixedContentPos&&n._hasScrollBar(l)){var o=n._getScrollbarSize();o&&(m.marginRight=o)}n.fixedContentPos&&(n.isIE7?a("body, html").css("overflow","hidden"):m.overflow="hidden");var p=n.st.mainClass;return n.isIE7&&(p+=" mfp-ie7"),p&&n._addClassToMFP(p),n.updateItemHTML(),y("BuildControls"),a("html").css(m),n.bgOverlay.add(n.wrap).prependTo(n.st.prependTo||a(document.body)),n._lastFocusedEl=document.activeElement,setTimeout(function(){n.content?(n._addClassToMFP(k),n._setFocus()):n.bgOverlay.addClass(k),s.on("focusin"+j,n._onFocusIn)},16),n.isOpen=!0,n.updateSize(l),y(g),b},close:function(){if(!n.isOpen)return;y(c),n.isOpen=!1,n.st.removalDelay&&!n.isLowIE&&n.supportsTransition?(n._addClassToMFP(l),setTimeout(function(){n._close()},n.st.removalDelay)):n._close()},_close:function(){y(b);var c=l+" "+k+" ";n.bgOverlay.detach(),n.wrap.detach(),n.container.empty(),n.st.mainClass&&(c+=n.st.mainClass+" "),n._removeClassFromMFP(c);if(n.fixedContentPos){var e={marginRight:""};n.isIE7?a("body, html").css("overflow",""):e.overflow="",a("html").css(e)}s.off("keyup"+j+" focusin"+j),n.ev.off(j),n.wrap.attr("class","mfp-wrap").removeAttr("style"),n.bgOverlay.attr("class","mfp-bg"),n.container.attr("class","mfp-container"),n.st.showCloseBtn&&(!n.st.closeBtnInside||n.currTemplate[n.currItem.type]===!0)&&n.currTemplate.closeBtn&&n.currTemplate.closeBtn.detach(),n._lastFocusedEl&&a(n._lastFocusedEl).focus(),n.currItem=null,n.content=null,n.currTemplate=null,n.prevHeight=0,y(d)},updateSize:function(a){if(n.isIOS){var b=document.documentElement.clientWidth/window.innerWidth,c=window.innerHeight*b;n.wrap.css("height",c),n.wH=c}else n.wH=a||r.height();n.fixedContentPos||n.wrap.css("height",n.wH),y("Resize")},updateItemHTML:function(){var b=n.items[n.index];n.contentContainer.detach(),n.content&&n.content.detach(),b.parsed||(b=n.parseEl(n.index));var c=b.type;y("BeforeChange",[n.currItem?n.currItem.type:"",c]),n.currItem=b;if(!n.currTemplate[c]){var d=n.st[c]?n.st[c].markup:!1;y("FirstMarkupParse",d),d?n.currTemplate[c]=a(d):n.currTemplate[c]=!0}t&&t!==b.type&&n.container.removeClass("mfp-"+t+"-holder");var e=n["get"+c.charAt(0).toUpperCase()+c.slice(1)](b,n.currTemplate[c]);n.appendContent(e,c),b.preloaded=!0,y(h,b),t=b.type,n.container.prepend(n.contentContainer),y("AfterChange")},appendContent:function(a,b){n.content=a,a?n.st.showCloseBtn&&n.st.closeBtnInside&&n.currTemplate[b]===!0?n.content.find(".mfp-close").length||n.content.append(z()):n.content=a:n.content="",y(e),n.container.addClass("mfp-"+b+"-holder"),n.contentContainer.append(n.content)},parseEl:function(b){var c=n.items[b],d;c.tagName?c={el:a(c)}:(d=c.type,c={data:c,src:c.src});if(c.el){var e=n.types;for(var f=0;f<e.length;f++)if(c.el.hasClass("mfp-"+e[f])){d=e[f];break}c.src=c.el.attr("data-mfp-src"),c.src||(c.src=c.el.attr("href"))}return c.type=d||n.st.type||"inline",c.index=b,c.parsed=!0,n.items[b]=c,y("ElementParse",c),n.items[b]},addGroup:function(a,b){var c=function(c){c.mfpEl=this,n._openClick(c,a,b)};b||(b={});var d="click.magnificPopup";b.mainEl=a,b.items?(b.isObj=!0,a.off(d).on(d,c)):(b.isObj=!1,b.delegate?a.off(d).on(d,b.delegate,c):(b.items=a,a.off(d).on(d,c)))},_openClick:function(b,c,d){var e=d.midClick!==undefined?d.midClick:a.magnificPopup.defaults.midClick;if(!e&&(b.which===2||b.ctrlKey||b.metaKey))return;var f=d.disableOn!==undefined?d.disableOn:a.magnificPopup.defaults.disableOn;if(f)if(a.isFunction(f)){if(!f.call(n))return!0}else if(r.width()<f)return!0;b.type&&(b.preventDefault(),n.isOpen&&b.stopPropagation()),d.el=a(b.mfpEl),d.delegate&&(d.items=c.find(d.delegate)),n.open(d)},updateStatus:function(a,b){if(n.preloader){q!==a&&n.container.removeClass("mfp-s-"+q),!b&&a==="loading"&&(b=n.st.tLoading);var c={status:a,text:b};y("UpdateStatus",c),a=c.status,b=c.text,n.preloader.html(b),n.preloader.find("a").on("click",function(a){a.stopImmediatePropagation()}),n.container.addClass("mfp-s-"+a),q=a}},_checkIfClose:function(b){if(a(b).hasClass(m))return;var c=n.st.closeOnContentClick,d=n.st.closeOnBgClick;if(c&&d)return!0;if(!n.content||a(b).hasClass("mfp-close")||n.preloader&&b===n.preloader[0])return!0;if(b!==n.content[0]&&!a.contains(n.content[0],b)){if(d&&a.contains(document,b))return!0}else if(c)return!0;return!1},_addClassToMFP:function(a){n.bgOverlay.addClass(a),n.wrap.addClass(a)},_removeClassFromMFP:function(a){this.bgOverlay.removeClass(a),n.wrap.removeClass(a)},_hasScrollBar:function(a){return(n.isIE7?s.height():document.body.scrollHeight)>(a||r.height())},_setFocus:function(){(n.st.focus?n.content.find(n.st.focus).eq(0):n.wrap).focus()},_onFocusIn:function(b){if(b.target!==n.wrap[0]&&!a.contains(n.wrap[0],b.target))return n._setFocus(),!1},_parseMarkup:function(b,c,d){var e;d.data&&(c=a.extend(d.data,c)),y(f,[b,c,d]),a.each(c,function(a,c){if(c===undefined||c===!1)return!0;e=a.split("_");if(e.length>1){var d=b.find(j+"-"+e[0]);if(d.length>0){var f=e[1];f==="replaceWith"?d[0]!==c[0]&&d.replaceWith(c):f==="img"?d.is("img")?d.attr("src",c):d.replaceWith('<img src="'+c+'" class="'+d.attr("class")+'" />'):d.attr(e[1],c)}}else b.find(j+"-"+a).html(c)})},_getScrollbarSize:function(){if(n.scrollbarSize===undefined){var a=document.createElement("div");a.style.cssText="width: 99px; height: 99px; overflow: scroll; position: absolute; top: -9999px;",document.body.appendChild(a),n.scrollbarSize=a.offsetWidth-a.clientWidth,document.body.removeChild(a)}return n.scrollbarSize}},a.magnificPopup={instance:null,proto:o.prototype,modules:[],open:function(b,c){return A(),b?b=a.extend(!0,{},b):b={},b.isObj=!0,b.index=c||0,this.instance.open(b)},close:function(){return a.magnificPopup.instance&&a.magnificPopup.instance.close()},registerModule:function(b,c){c.options&&(a.magnificPopup.defaults[b]=c.options),a.extend(this.proto,c.proto),this.modules.push(b)},defaults:{disableOn:0,key:null,midClick:!1,mainClass:"",preloader:!0,focus:"",closeOnContentClick:!1,closeOnBgClick:!0,closeBtnInside:!0,showCloseBtn:!0,enableEscapeKey:!0,modal:!1,alignTop:!1,removalDelay:0,prependTo:null,fixedContentPos:"auto",fixedBgPos:"auto",overflowY:"auto",closeMarkup:'<button title="%title%" type="button" class="mfp-close">&times;</button>',tClose:"Close (Esc)",tLoading:"Loading..."}},a.fn.magnificPopup=function(b){A();var c=a(this);if(typeof b=="string")if(b==="open"){var d,e=p?c.data("magnificPopup"):c[0].magnificPopup,f=parseInt(arguments[1],10)||0;e.items?d=e.items[f]:(d=c,e.delegate&&(d=d.find(e.delegate)),d=d.eq(f)),n._openClick({mfpEl:d},c,e)}else n.isOpen&&n[b].apply(n,Array.prototype.slice.call(arguments,1));else b=a.extend(!0,{},b),p?c.data("magnificPopup",b):c[0].magnificPopup=b,n.addGroup(c,b);return c};var C="inline",D,E,F,G=function(){F&&(E.after(F.addClass(D)).detach(),F=null)};a.magnificPopup.registerModule(C,{options:{hiddenClass:"hide",markup:"",tNotFound:"Content not found"},proto:{initInline:function(){n.types.push(C),w(b+"."+C,function(){G()})},getInline:function(b,c){G();if(b.src){var d=n.st.inline,e=a(b.src);if(e.length){var f=e[0].parentNode;f&&f.tagName&&(E||(D=d.hiddenClass,E=x(D),D="mfp-"+D),F=e.after(E).detach().removeClass(D)),n.updateStatus("ready")}else n.updateStatus("error",d.tNotFound),e=a("<div>");return b.inlineElement=e,e}return n.updateStatus("ready"),n._parseMarkup(c,{},b),c}}});var H="ajax",I,J=function(){I&&a(document.body).removeClass(I)},K=function(){J(),n.req&&n.req.abort()};a.magnificPopup.registerModule(H,{options:{settings:null,cursor:"mfp-ajax-cur",tError:'<a href="%url%">The content</a> could not be loaded.'},proto:{initAjax:function(){n.types.push(H),I=n.st.ajax.cursor,w(b+"."+H,K),w("BeforeChange."+H,K)},getAjax:function(b){I&&a(document.body).addClass(I),n.updateStatus("loading");var c=a.extend({url:b.src,success:function(c,d,e){var f={data:c,xhr:e};y("ParseAjax",f),n.appendContent(a(f.data),H),b.finished=!0,J(),n._setFocus(),setTimeout(function(){n.wrap.addClass(k)},16),n.updateStatus("ready"),y("AjaxContentAdded")},error:function(){J(),b.finished=b.loadError=!0,n.updateStatus("error",n.st.ajax.tError.replace("%url%",b.src))}},n.st.ajax.settings);return n.req=a.ajax(c),""}}});var L,M=function(){return L===undefined&&(L=document.createElement("p").style.MozTransform!==undefined),L};a.magnificPopup.registerModule("zoom",{options:{enabled:!1,easing:"ease-in-out",duration:300,opener:function(a){return a.is("img")?a:a.find("img")}},proto:{initZoom:function(){var a=n.st.zoom,d=".zoom",e;if(!a.enabled||!n.supportsTransition)return;var f=a.duration,g=function(b){var c=b.clone().removeAttr("style").removeAttr("class").addClass("mfp-animated-image"),d="all "+a.duration/1e3+"s "+a.easing,e={position:"fixed",zIndex:9999,left:0,top:0,"-webkit-backface-visibility":"hidden"},f="transition";return e["-webkit-"+f]=e["-moz-"+f]=e["-o-"+f]=e[f]=d,c.css(e),c},h=function(){n.content.css("visibility","visible")},i,j;w("BuildControls"+d,function(){if(n._allowZoom()){clearTimeout(i),n.content.css("visibility","hidden"),e=n._getItemToZoom();if(!e){h();return}j=g(e),j.css(n._getOffset()),n.wrap.append(j),i=setTimeout(function(){j.css(n._getOffset(!0)),i=setTimeout(function(){h(),setTimeout(function(){j.remove(),e=j=null,y("ZoomAnimationEnded")},16)},f)},16)}}),w(c+d,function(){if(n._allowZoom()){clearTimeout(i),n.st.removalDelay=f;if(!e){e=n._getItemToZoom();if(!e)return;j=g(e)}j.css(n._getOffset(!0)),n.wrap.append(j),n.content.css("visibility","hidden"),setTimeout(function(){j.css(n._getOffset())},16)}}),w(b+d,function(){n._allowZoom()&&(h(),j&&j.remove(),e=null)})},_allowZoom:function(){return n.currItem.type==="image"},_getItemToZoom:function(){return n.currItem.hasSize?n.currItem.img:!1},_getOffset:function(b){var c;b?c=n.currItem.img:c=n.st.zoom.opener(n.currItem.el||n.currItem);var d=c.offset(),e=parseInt(c.css("padding-top"),10),f=parseInt(c.css("padding-bottom"),10);d.top-=a(window).scrollTop()-e;var g={width:c.width(),height:(p?c.innerHeight():c[0].offsetHeight)-f-e};return M()?g["-moz-transform"]=g.transform="translate("+d.left+"px,"+d.top+"px)":(g.left=d.left,g.top=d.top),g}}});var N="iframe",O="//about:blank",P=function(a){if(n.currTemplate[N]){var b=n.currTemplate[N].find("iframe");b.length&&(a||(b[0].src=O),n.isIE8&&b.css("display",a?"block":"none"))}};a.magnificPopup.registerModule(N,{options:{markup:'<div class="mfp-iframe-scaler"><div class="mfp-close"></div><iframe class="mfp-iframe" src="//about:blank" frameborder="0" allowfullscreen></iframe></div>',srcAction:"iframe_src",patterns:{youtube:{index:"youtube.com",id:"v=",src:"//www.youtube.com/embed/%id%?autoplay=1"},vimeo:{index:"vimeo.com/",id:"/",src:"//player.vimeo.com/video/%id%?autoplay=1"},gmaps:{index:"//maps.google.",src:"%id%&output=embed"}}},proto:{initIframe:function(){n.types.push(N),w("BeforeChange",function(a,b,c){b!==c&&(b===N?P():c===N&&P(!0))}),w(b+"."+N,function(){P()})},getIframe:function(b,c){var d=b.src,e=n.st.iframe;a.each(e.patterns,function(){if(d.indexOf(this.index)>-1)return this.id&&(typeof this.id=="string"?d=d.substr(d.lastIndexOf(this.id)+this.id.length,d.length):d=this.id.call(this,d)),d=this.src.replace("%id%",d),!1});var f={};return e.srcAction&&(f[e.srcAction]=d),n._parseMarkup(c,f,b),n.updateStatus("ready"),c}}});var Q=function(a){var b=n.items.length;return a>b-1?a-b:a<0?b+a:a},R=function(a,b,c){return a.replace(/%curr%/gi,b+1).replace(/%total%/gi,c)};a.magnificPopup.registerModule("gallery",{options:{enabled:!1,arrowMarkup:'<button title="%title%" type="button" class="mfp-arrow mfp-arrow-%dir%"></button>',preload:[0,2],navigateByImgClick:!0,arrows:!0,tPrev:"Previous (Left arrow key)",tNext:"Next (Right arrow key)",tCounter:"%curr% of %total%"},proto:{initGallery:function(){var c=n.st.gallery,d=".mfp-gallery",e=Boolean(a.fn.mfpFastClick);n.direction=!0;if(!c||!c.enabled)return!1;u+=" mfp-gallery",w(g+d,function(){c.navigateByImgClick&&n.wrap.on("click"+d,".mfp-img",function(){if(n.items.length>1)return n.next(),!1}),s.on("keydown"+d,function(a){a.keyCode===37?n.prev():a.keyCode===39&&n.next()})}),w("UpdateStatus"+d,function(a,b){b.text&&(b.text=R(b.text,n.currItem.index,n.items.length))}),w(f+d,function(a,b,d,e){var f=n.items.length;d.counter=f>1?R(c.tCounter,e.index,f):""}),w("BuildControls"+d,function(){if(n.items.length>1&&c.arrows&&!n.arrowLeft){var b=c.arrowMarkup,d=n.arrowLeft=a(b.replace(/%title%/gi,c.tPrev).replace(/%dir%/gi,"left")).addClass(m),f=n.arrowRight=a(b.replace(/%title%/gi,c.tNext).replace(/%dir%/gi,"right")).addClass(m),g=e?"mfpFastClick":"click";d[g](function(){n.prev()}),f[g](function(){n.next()}),n.isIE7&&(x("b",d[0],!1,!0),x("a",d[0],!1,!0),x("b",f[0],!1,!0),x("a",f[0],!1,!0)),n.container.append(d.add(f))}}),w(h+d,function(){n._preloadTimeout&&clearTimeout(n._preloadTimeout),n._preloadTimeout=setTimeout(function(){n.preloadNearbyImages(),n._preloadTimeout=null},16)}),w(b+d,function(){s.off(d),n.wrap.off("click"+d),n.arrowLeft&&e&&n.arrowLeft.add(n.arrowRight).destroyMfpFastClick(),n.arrowRight=n.arrowLeft=null})},next:function(){n.direction=!0,n.index=Q(n.index+1),n.updateItemHTML()},prev:function(){n.direction=!1,n.index=Q(n.index-1),n.updateItemHTML()},goTo:function(a){n.direction=a>=n.index,n.index=a,n.updateItemHTML()},preloadNearbyImages:function(){var a=n.st.gallery.preload,b=Math.min(a[0],n.items.length),c=Math.min(a[1],n.items.length),d;for(d=1;d<=(n.direction?c:b);d++)n._preloadItem(n.index+d);for(d=1;d<=(n.direction?b:c);d++)n._preloadItem(n.index-d)},_preloadItem:function(b){b=Q(b);if(n.items[b].preloaded)return;var c=n.items[b];c.parsed||(c=n.parseEl(b)),y("LazyLoad",c),c.type==="image"&&(c.img=a('<img class="mfp-img" />').on("load.mfploader",function(){c.hasSize=!0}).on("error.mfploader",function(){c.hasSize=!0,c.loadError=!0,y("LazyLoadError",c)}).attr("src",c.src)),c.preloaded=!0}}});var S="retina";a.magnificPopup.registerModule(S,{options:{replaceSrc:function(a){return a.src.replace(/\.\w+$/,function(a){return"@2x"+a})},ratio:1},proto:{initRetina:function(){if(window.devicePixelRatio>1){var a=n.st.retina,b=a.ratio;b=isNaN(b)?b():b,b>1&&(w("ImageHasSize."+S,function(a,c){c.img.css({"max-width":c.img[0].naturalWidth/b,width:"100%"})}),w("ElementParse."+S,function(c,d){d.src=a.replaceSrc(d,b)}))}}}}),A()})

;/*})'"*/
;/*})'"*/
/*
 * ----------------------------- JSTORAGE -------------------------------------
 * Simple local storage wrapper to save data on the browser side, supporting
 * all major browsers - IE6+, Firefox2+, Safari4+, Chrome4+ and Opera 10.5+
 *
 * Author: Andris Reinman, andris.reinman@gmail.com
 * Project homepage: www.jstorage.info
 *
 * Licensed under Unlicense:
 *
 * This is free and unencumbered software released into the public domain.
 *
 * Anyone is free to copy, modify, publish, use, compile, sell, or
 * distribute this software, either in source code form or as a compiled
 * binary, for any purpose, commercial or non-commercial, and by any
 * means.
 *
 * In jurisdictions that recognize copyright laws, the author or authors
 * of this software dedicate any and all copyright interest in the
 * software to the public domain. We make this dedication for the benefit
 * of the public at large and to the detriment of our heirs and
 * successors. We intend this dedication to be an overt act of
 * relinquishment in perpetuity of all present and future rights to this
 * software under copyright law.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 *
 * For more information, please refer to <http://unlicense.org/>
 */

/* global ActiveXObject: false */
/* jshint browser: true */

(function() {
    'use strict';

    var
    /* jStorage version */
        JSTORAGE_VERSION = '0.4.12',

        /* detect a dollar object or create one if not found */
        $ = window.jQuery || window.$ || (window.$ = {}),

        /* check for a JSON handling support */
        JSON = {
            parse: window.JSON && (window.JSON.parse || window.JSON.decode) ||
                String.prototype.evalJSON && function(str) {
                    return String(str).evalJSON();
            } ||
                $.parseJSON ||
                $.evalJSON,
            stringify: Object.toJSON ||
                window.JSON && (window.JSON.stringify || window.JSON.encode) ||
                $.toJSON
        };

    // Break if no JSON support was found
    if (typeof JSON.parse !== 'function' || typeof JSON.stringify !== 'function') {
        throw new Error('No JSON support found, include //cdnjs.cloudflare.com/ajax/libs/json2/20110223/json2.js to page');
    }

    var
    /* This is the object, that holds the cached values */
        _storage = {
            __jstorage_meta: {
                CRC32: {}
            }
        },

        /* Actual browser storage (localStorage or globalStorage['domain']) */
        _storage_service = {
            jStorage: '{}'
        },

        /* DOM element for older IE versions, holds userData behavior */
        _storage_elm = null,

        /* How much space does the storage take */
        _storage_size = 0,

        /* which backend is currently used */
        _backend = false,

        /* onchange observers */
        _observers = {},

        /* timeout to wait after onchange event */
        _observer_timeout = false,

        /* last update time */
        _observer_update = 0,

        /* pubsub observers */
        _pubsub_observers = {},

        /* skip published items older than current timestamp */
        _pubsub_last = +new Date(),

        /* Next check for TTL */
        _ttl_timeout,

        /**
         * XML encoding and decoding as XML nodes can't be JSON'ized
         * XML nodes are encoded and decoded if the node is the value to be saved
         * but not if it's as a property of another object
         * Eg. -
         *   $.jStorage.set('key', xmlNode);        // IS OK
         *   $.jStorage.set('key', {xml: xmlNode}); // NOT OK
         */
        _XMLService = {

            /**
             * Validates a XML node to be XML
             * based on jQuery.isXML function
             */
            isXML: function(elm) {
                var documentElement = (elm ? elm.ownerDocument || elm : 0).documentElement;
                return documentElement ? documentElement.nodeName !== 'HTML' : false;
            },

            /**
             * Encodes a XML node to string
             * based on http://www.mercurytide.co.uk/news/article/issues-when-working-ajax/
             */
            encode: function(xmlNode) {
                if (!this.isXML(xmlNode)) {
                    return false;
                }
                try { // Mozilla, Webkit, Opera
                    return new XMLSerializer().serializeToString(xmlNode);
                } catch (E1) {
                    try { // IE
                        return xmlNode.xml;
                    } catch (E2) {}
                }
                return false;
            },

            /**
             * Decodes a XML node from string
             * loosely based on http://outwestmedia.com/jquery-plugins/xmldom/
             */
            decode: function(xmlString) {
                var dom_parser = ('DOMParser' in window && (new DOMParser()).parseFromString) ||
                    (window.ActiveXObject && function(_xmlString) {
                        var xml_doc = new ActiveXObject('Microsoft.XMLDOM');
                        xml_doc.async = 'false';
                        xml_doc.loadXML(_xmlString);
                        return xml_doc;
                    }),
                    resultXML;
                if (!dom_parser) {
                    return false;
                }
                resultXML = dom_parser.call('DOMParser' in window && (new DOMParser()) || window, xmlString, 'text/xml');
                return this.isXML(resultXML) ? resultXML : false;
            }
        };


    ////////////////////////// PRIVATE METHODS ////////////////////////

    /**
     * Initialization function. Detects if the browser supports DOM Storage
     * or userData behavior and behaves accordingly.
     */
    function _init() {
        /* Check if browser supports localStorage */
        var localStorageReallyWorks = false;
        if ('localStorage' in window) {
            try {
                window.localStorage.setItem('_tmptest', 'tmpval');
                localStorageReallyWorks = true;
                window.localStorage.removeItem('_tmptest');
            } catch (BogusQuotaExceededErrorOnIos5) {
                // Thanks be to iOS5 Private Browsing mode which throws
                // QUOTA_EXCEEDED_ERRROR DOM Exception 22.
            }
        }

        if (localStorageReallyWorks) {
            try {
                if (window.localStorage) {
                    _storage_service = window.localStorage;
                    _backend = 'localStorage';
                    _observer_update = _storage_service.jStorage_update;
                }
            } catch (E3) { /* Firefox fails when touching localStorage and cookies are disabled */ }
        }
        /* Check if browser supports globalStorage */
        else if ('globalStorage' in window) {
            try {
                if (window.globalStorage) {
                    if (window.location.hostname == 'localhost') {
                        _storage_service = window.globalStorage['localhost.localdomain'];
                    } else {
                        _storage_service = window.globalStorage[window.location.hostname];
                    }
                    _backend = 'globalStorage';
                    _observer_update = _storage_service.jStorage_update;
                }
            } catch (E4) { /* Firefox fails when touching localStorage and cookies are disabled */ }
        }
        /* Check if browser supports userData behavior */
        else {
            _storage_elm = document.createElement('link');
            if (_storage_elm.addBehavior) {

                /* Use a DOM element to act as userData storage */
                _storage_elm.style.behavior = 'url(#default#userData)';

                /* userData element needs to be inserted into the DOM! */
                document.getElementsByTagName('head')[0].appendChild(_storage_elm);

                try {
                    _storage_elm.load('jStorage');
                } catch (E) {
                    // try to reset cache
                    _storage_elm.setAttribute('jStorage', '{}');
                    _storage_elm.save('jStorage');
                    _storage_elm.load('jStorage');
                }

                var data = '{}';
                try {
                    data = _storage_elm.getAttribute('jStorage');
                } catch (E5) {}

                try {
                    _observer_update = _storage_elm.getAttribute('jStorage_update');
                } catch (E6) {}

                _storage_service.jStorage = data;
                _backend = 'userDataBehavior';
            } else {
                _storage_elm = null;
                return;
            }
        }

        // Load data from storage
        _load_storage();

        // remove dead keys
        _handleTTL();

        // start listening for changes
        _setupObserver();

        // initialize publish-subscribe service
        _handlePubSub();

        // handle cached navigation
        if ('addEventListener' in window) {
            window.addEventListener('pageshow', function(event) {
                if (event.persisted) {
                    _storageObserver();
                }
            }, false);
        }
    }

    /**
     * Reload data from storage when needed
     */
    function _reloadData() {
        var data = '{}';

        if (_backend == 'userDataBehavior') {
            _storage_elm.load('jStorage');

            try {
                data = _storage_elm.getAttribute('jStorage');
            } catch (E5) {}

            try {
                _observer_update = _storage_elm.getAttribute('jStorage_update');
            } catch (E6) {}

            _storage_service.jStorage = data;
        }

        _load_storage();

        // remove dead keys
        _handleTTL();

        _handlePubSub();
    }

    /**
     * Sets up a storage change observer
     */
    function _setupObserver() {
        if (_backend == 'localStorage' || _backend == 'globalStorage') {
            if ('addEventListener' in window) {
                window.addEventListener('storage', _storageObserver, false);
            } else {
                document.attachEvent('onstorage', _storageObserver);
            }
        } else if (_backend == 'userDataBehavior') {
            setInterval(_storageObserver, 1000);
        }
    }

    /**
     * Fired on any kind of data change, needs to check if anything has
     * really been changed
     */
    function _storageObserver() {
        var updateTime;
        // cumulate change notifications with timeout
        clearTimeout(_observer_timeout);
        _observer_timeout = setTimeout(function() {

            if (_backend == 'localStorage' || _backend == 'globalStorage') {
                updateTime = _storage_service.jStorage_update;
            } else if (_backend == 'userDataBehavior') {
                _storage_elm.load('jStorage');
                try {
                    updateTime = _storage_elm.getAttribute('jStorage_update');
                } catch (E5) {}
            }

            if (updateTime && updateTime != _observer_update) {
                _observer_update = updateTime;
                _checkUpdatedKeys();
            }

        }, 25);
    }

    /**
     * Reloads the data and checks if any keys are changed
     */
    function _checkUpdatedKeys() {
        var oldCrc32List = JSON.parse(JSON.stringify(_storage.__jstorage_meta.CRC32)),
            newCrc32List;

        _reloadData();
        newCrc32List = JSON.parse(JSON.stringify(_storage.__jstorage_meta.CRC32));

        var key,
            updated = [],
            removed = [];

        for (key in oldCrc32List) {
            if (oldCrc32List.hasOwnProperty(key)) {
                if (!newCrc32List[key]) {
                    removed.push(key);
                    continue;
                }
                if (oldCrc32List[key] != newCrc32List[key] && String(oldCrc32List[key]).substr(0, 2) == '2.') {
                    updated.push(key);
                }
            }
        }

        for (key in newCrc32List) {
            if (newCrc32List.hasOwnProperty(key)) {
                if (!oldCrc32List[key]) {
                    updated.push(key);
                }
            }
        }

        _fireObservers(updated, 'updated');
        _fireObservers(removed, 'deleted');
    }

    /**
     * Fires observers for updated keys
     *
     * @param {Array|String} keys Array of key names or a key
     * @param {String} action What happened with the value (updated, deleted, flushed)
     */
    function _fireObservers(keys, action) {
        keys = [].concat(keys || []);

        var i, j, len, jlen;

        if (action == 'flushed') {
            keys = [];
            for (var key in _observers) {
                if (_observers.hasOwnProperty(key)) {
                    keys.push(key);
                }
            }
            action = 'deleted';
        }
        for (i = 0, len = keys.length; i < len; i++) {
            if (_observers[keys[i]]) {
                for (j = 0, jlen = _observers[keys[i]].length; j < jlen; j++) {
                    _observers[keys[i]][j](keys[i], action);
                }
            }
            if (_observers['*']) {
                for (j = 0, jlen = _observers['*'].length; j < jlen; j++) {
                    _observers['*'][j](keys[i], action);
                }
            }
        }
    }

    /**
     * Publishes key change to listeners
     */
    function _publishChange() {
        var updateTime = (+new Date()).toString();

        if (_backend == 'localStorage' || _backend == 'globalStorage') {
            try {
                _storage_service.jStorage_update = updateTime;
            } catch (E8) {
                // safari private mode has been enabled after the jStorage initialization
                _backend = false;
            }
        } else if (_backend == 'userDataBehavior') {
            _storage_elm.setAttribute('jStorage_update', updateTime);
            _storage_elm.save('jStorage');
        }

        _storageObserver();
    }

    /**
     * Loads the data from the storage based on the supported mechanism
     */
    function _load_storage() {
        /* if jStorage string is retrieved, then decode it */
        if (_storage_service.jStorage) {
            try {
                _storage = JSON.parse(String(_storage_service.jStorage));
            } catch (E6) {
                _storage_service.jStorage = '{}';
            }
        } else {
            _storage_service.jStorage = '{}';
        }
        _storage_size = _storage_service.jStorage ? String(_storage_service.jStorage).length : 0;

        if (!_storage.__jstorage_meta) {
            _storage.__jstorage_meta = {};
        }
        if (!_storage.__jstorage_meta.CRC32) {
            _storage.__jstorage_meta.CRC32 = {};
        }
    }

    /**
     * This functions provides the 'save' mechanism to store the jStorage object
     */
    function _save() {
        _dropOldEvents(); // remove expired events
        try {
            _storage_service.jStorage = JSON.stringify(_storage);
            // If userData is used as the storage engine, additional
            if (_storage_elm) {
                _storage_elm.setAttribute('jStorage', _storage_service.jStorage);
                _storage_elm.save('jStorage');
            }
            _storage_size = _storage_service.jStorage ? String(_storage_service.jStorage).length : 0;
        } catch (E7) { /* probably cache is full, nothing is saved this way*/ }
    }

    /**
     * Function checks if a key is set and is string or numberic
     *
     * @param {String} key Key name
     */
    function _checkKey(key) {
        if (typeof key != 'string' && typeof key != 'number') {
            throw new TypeError('Key name must be string or numeric');
        }
        if (key == '__jstorage_meta') {
            throw new TypeError('Reserved key name');
        }
        return true;
    }

    /**
     * Removes expired keys
     */
    function _handleTTL() {
        var curtime, i, TTL, CRC32, nextExpire = Infinity,
            changed = false,
            deleted = [];

        clearTimeout(_ttl_timeout);

        if (!_storage.__jstorage_meta || typeof _storage.__jstorage_meta.TTL != 'object') {
            // nothing to do here
            return;
        }

        curtime = +new Date();
        TTL = _storage.__jstorage_meta.TTL;

        CRC32 = _storage.__jstorage_meta.CRC32;
        for (i in TTL) {
            if (TTL.hasOwnProperty(i)) {
                if (TTL[i] <= curtime) {
                    delete TTL[i];
                    delete CRC32[i];
                    delete _storage[i];
                    changed = true;
                    deleted.push(i);
                } else if (TTL[i] < nextExpire) {
                    nextExpire = TTL[i];
                }
            }
        }

        // set next check
        if (nextExpire != Infinity) {
            _ttl_timeout = setTimeout(_handleTTL, Math.min(nextExpire - curtime, 0x7FFFFFFF));
        }

        // save changes
        if (changed) {
            _save();
            _publishChange();
            _fireObservers(deleted, 'deleted');
        }
    }

    /**
     * Checks if there's any events on hold to be fired to listeners
     */
    function _handlePubSub() {
        var i, len;
        if (!_storage.__jstorage_meta.PubSub) {
            return;
        }
        var pubelm,
            _pubsubCurrent = _pubsub_last,
            needFired = [];

        for (i = len = _storage.__jstorage_meta.PubSub.length - 1; i >= 0; i--) {
            pubelm = _storage.__jstorage_meta.PubSub[i];
            if (pubelm[0] > _pubsub_last) {
                _pubsubCurrent = pubelm[0];
                needFired.unshift(pubelm);
            }
        }

        for (i = needFired.length - 1; i >= 0; i--) {
            _fireSubscribers(needFired[i][1], needFired[i][2]);
        }

        _pubsub_last = _pubsubCurrent;
    }

    /**
     * Fires all subscriber listeners for a pubsub channel
     *
     * @param {String} channel Channel name
     * @param {Mixed} payload Payload data to deliver
     */
    function _fireSubscribers(channel, payload) {
        if (_pubsub_observers[channel]) {
            for (var i = 0, len = _pubsub_observers[channel].length; i < len; i++) {
                // send immutable data that can't be modified by listeners
                try {
                    _pubsub_observers[channel][i](channel, JSON.parse(JSON.stringify(payload)));
                } catch (E) {}
            }
        }
    }

    /**
     * Remove old events from the publish stream (at least 2sec old)
     */
    function _dropOldEvents() {
        if (!_storage.__jstorage_meta.PubSub) {
            return;
        }

        var retire = +new Date() - 2000;

        for (var i = 0, len = _storage.__jstorage_meta.PubSub.length; i < len; i++) {
            if (_storage.__jstorage_meta.PubSub[i][0] <= retire) {
                // deleteCount is needed for IE6
                _storage.__jstorage_meta.PubSub.splice(i, _storage.__jstorage_meta.PubSub.length - i);
                break;
            }
        }

        if (!_storage.__jstorage_meta.PubSub.length) {
            delete _storage.__jstorage_meta.PubSub;
        }

    }

    /**
     * Publish payload to a channel
     *
     * @param {String} channel Channel name
     * @param {Mixed} payload Payload to send to the subscribers
     */
    function _publish(channel, payload) {
        if (!_storage.__jstorage_meta) {
            _storage.__jstorage_meta = {};
        }
        if (!_storage.__jstorage_meta.PubSub) {
            _storage.__jstorage_meta.PubSub = [];
        }

        _storage.__jstorage_meta.PubSub.unshift([+new Date(), channel, payload]);

        _save();
        _publishChange();
    }


    /**
     * JS Implementation of MurmurHash2
     *
     *  SOURCE: https://github.com/garycourt/murmurhash-js (MIT licensed)
     *
     * @author <a href='mailto:gary.court@gmail.com'>Gary Court</a>
     * @see http://github.com/garycourt/murmurhash-js
     * @author <a href='mailto:aappleby@gmail.com'>Austin Appleby</a>
     * @see http://sites.google.com/site/murmurhash/
     *
     * @param {string} str ASCII only
     * @param {number} seed Positive integer only
     * @return {number} 32-bit positive integer hash
     */

    function murmurhash2_32_gc(str, seed) {
        var
            l = str.length,
            h = seed ^ l,
            i = 0,
            k;

        while (l >= 4) {
            k =
                ((str.charCodeAt(i) & 0xff)) |
                ((str.charCodeAt(++i) & 0xff) << 8) |
                ((str.charCodeAt(++i) & 0xff) << 16) |
                ((str.charCodeAt(++i) & 0xff) << 24);

            k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));
            k ^= k >>> 24;
            k = (((k & 0xffff) * 0x5bd1e995) + ((((k >>> 16) * 0x5bd1e995) & 0xffff) << 16));

            h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16)) ^ k;

            l -= 4;
            ++i;
        }

        switch (l) {
            case 3:
                h ^= (str.charCodeAt(i + 2) & 0xff) << 16;
                /* falls through */
            case 2:
                h ^= (str.charCodeAt(i + 1) & 0xff) << 8;
                /* falls through */
            case 1:
                h ^= (str.charCodeAt(i) & 0xff);
                h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
        }

        h ^= h >>> 13;
        h = (((h & 0xffff) * 0x5bd1e995) + ((((h >>> 16) * 0x5bd1e995) & 0xffff) << 16));
        h ^= h >>> 15;

        return h >>> 0;
    }

    ////////////////////////// PUBLIC INTERFACE /////////////////////////

    $.jStorage = {
        /* Version number */
        version: JSTORAGE_VERSION,

        /**
         * Sets a key's value.
         *
         * @param {String} key Key to set. If this value is not set or not
         *              a string an exception is raised.
         * @param {Mixed} value Value to set. This can be any value that is JSON
         *              compatible (Numbers, Strings, Objects etc.).
         * @param {Object} [options] - possible options to use
         * @param {Number} [options.TTL] - optional TTL value, in milliseconds
         * @return {Mixed} the used value
         */
        set: function(key, value, options) {
            _checkKey(key);

            options = options || {};

            // undefined values are deleted automatically
            if (typeof value == 'undefined') {
                this.deleteKey(key);
                return value;
            }

            if (_XMLService.isXML(value)) {
                value = {
                    _is_xml: true,
                    xml: _XMLService.encode(value)
                };
            } else if (typeof value == 'function') {
                return undefined; // functions can't be saved!
            } else if (value && typeof value == 'object') {
                // clone the object before saving to _storage tree
                value = JSON.parse(JSON.stringify(value));
            }

            _storage[key] = value;

            _storage.__jstorage_meta.CRC32[key] = '2.' + murmurhash2_32_gc(JSON.stringify(value), 0x9747b28c);

            this.setTTL(key, options.TTL || 0); // also handles saving and _publishChange

            _fireObservers(key, 'updated');
            return value;
        },

        /**
         * Looks up a key in cache
         *
         * @param {String} key - Key to look up.
         * @param {mixed} def - Default value to return, if key didn't exist.
         * @return {Mixed} the key value, default value or null
         */
        get: function(key, def) {
            _checkKey(key);
            if (key in _storage) {
                if (_storage[key] && typeof _storage[key] == 'object' && _storage[key]._is_xml) {
                    return _XMLService.decode(_storage[key].xml);
                } else {
                    return _storage[key];
                }
            }
            return typeof(def) == 'undefined' ? null : def;
        },

        /**
         * Deletes a key from cache.
         *
         * @param {String} key - Key to delete.
         * @return {Boolean} true if key existed or false if it didn't
         */
        deleteKey: function(key) {
            _checkKey(key);
            if (key in _storage) {
                delete _storage[key];
                // remove from TTL list
                if (typeof _storage.__jstorage_meta.TTL == 'object' &&
                    key in _storage.__jstorage_meta.TTL) {
                    delete _storage.__jstorage_meta.TTL[key];
                }

                delete _storage.__jstorage_meta.CRC32[key];

                _save();
                _publishChange();
                _fireObservers(key, 'deleted');
                return true;
            }
            return false;
        },

        /**
         * Sets a TTL for a key, or remove it if ttl value is 0 or below
         *
         * @param {String} key - key to set the TTL for
         * @param {Number} ttl - TTL timeout in milliseconds
         * @return {Boolean} true if key existed or false if it didn't
         */
        setTTL: function(key, ttl) {
            var curtime = +new Date();
            _checkKey(key);
            ttl = Number(ttl) || 0;
            if (key in _storage) {

                if (!_storage.__jstorage_meta.TTL) {
                    _storage.__jstorage_meta.TTL = {};
                }

                // Set TTL value for the key
                if (ttl > 0) {
                    _storage.__jstorage_meta.TTL[key] = curtime + ttl;
                } else {
                    delete _storage.__jstorage_meta.TTL[key];
                }

                _save();

                _handleTTL();

                _publishChange();
                return true;
            }
            return false;
        },

        /**
         * Gets remaining TTL (in milliseconds) for a key or 0 when no TTL has been set
         *
         * @param {String} key Key to check
         * @return {Number} Remaining TTL in milliseconds
         */
        getTTL: function(key) {
            var curtime = +new Date(),
                ttl;
            _checkKey(key);
            if (key in _storage && _storage.__jstorage_meta.TTL && _storage.__jstorage_meta.TTL[key]) {
                ttl = _storage.__jstorage_meta.TTL[key] - curtime;
                return ttl || 0;
            }
            return 0;
        },

        /**
         * Deletes everything in cache.
         *
         * @return {Boolean} Always true
         */
        flush: function() {
            _storage = {
                __jstorage_meta: {
                    CRC32: {}
                }
            };
            _save();
            _publishChange();
            _fireObservers(null, 'flushed');
            return true;
        },

        /**
         * Returns a read-only copy of _storage
         *
         * @return {Object} Read-only copy of _storage
         */
        storageObj: function() {
            function F() {}
            F.prototype = _storage;
            return new F();
        },

        /**
         * Returns an index of all used keys as an array
         * ['key1', 'key2',..'keyN']
         *
         * @return {Array} Used keys
         */
        index: function() {
            var index = [],
                i;
            for (i in _storage) {
                if (_storage.hasOwnProperty(i) && i != '__jstorage_meta') {
                    index.push(i);
                }
            }
            return index;
        },

        /**
         * How much space in bytes does the storage take?
         *
         * @return {Number} Storage size in chars (not the same as in bytes,
         *                  since some chars may take several bytes)
         */
        storageSize: function() {
            return _storage_size;
        },

        /**
         * Which backend is currently in use?
         *
         * @return {String} Backend name
         */
        currentBackend: function() {
            return _backend;
        },

        /**
         * Test if storage is available
         *
         * @return {Boolean} True if storage can be used
         */
        storageAvailable: function() {
            return !!_backend;
        },

        /**
         * Register change listeners
         *
         * @param {String} key Key name
         * @param {Function} callback Function to run when the key changes
         */
        listenKeyChange: function(key, callback) {
            _checkKey(key);
            if (!_observers[key]) {
                _observers[key] = [];
            }
            _observers[key].push(callback);
        },

        /**
         * Remove change listeners
         *
         * @param {String} key Key name to unregister listeners against
         * @param {Function} [callback] If set, unregister the callback, if not - unregister all
         */
        stopListening: function(key, callback) {
            _checkKey(key);

            if (!_observers[key]) {
                return;
            }

            if (!callback) {
                delete _observers[key];
                return;
            }

            for (var i = _observers[key].length - 1; i >= 0; i--) {
                if (_observers[key][i] == callback) {
                    _observers[key].splice(i, 1);
                }
            }
        },

        /**
         * Subscribe to a Publish/Subscribe event stream
         *
         * @param {String} channel Channel name
         * @param {Function} callback Function to run when the something is published to the channel
         */
        subscribe: function(channel, callback) {
            channel = (channel || '').toString();
            if (!channel) {
                throw new TypeError('Channel not defined');
            }
            if (!_pubsub_observers[channel]) {
                _pubsub_observers[channel] = [];
            }
            _pubsub_observers[channel].push(callback);
        },

        /**
         * Publish data to an event stream
         *
         * @param {String} channel Channel name
         * @param {Mixed} payload Payload to deliver
         */
        publish: function(channel, payload) {
            channel = (channel || '').toString();
            if (!channel) {
                throw new TypeError('Channel not defined');
            }

            _publish(channel, payload);
        },

        /**
         * Reloads the data from browser storage
         */
        reInit: function() {
            _reloadData();
        },

        /**
         * Removes reference from global objects and saves it as jStorage
         *
         * @param {Boolean} option if needed to save object as simple 'jStorage' in windows context
         */
        noConflict: function(saveInGlobal) {
            delete window.$.jStorage;

            if (saveInGlobal) {
                window.jStorage = this;
            }

            return this;
        }
    };

    // Initialize jStorage
    _init();

})();
;/*})'"*/
;/*})'"*/
!function(e,n){"function"==typeof define&&define.amd?define(n):"object"==typeof exports?module.exports=n(require,exports,module):e.ouibounce=n()}(this,function(e,n,o){return function(e,n){"use strict";function o(e,n){return"undefined"==typeof e?n:e}function i(e){var n=24*e*60*60*1e3,o=new Date;return o.setTime(o.getTime()+n),"; expires="+o.toUTCString()}function t(){s()||(L.addEventListener("mouseleave",u),L.addEventListener("mouseenter",r),L.addEventListener("keydown",c))}function u(e){e.clientY>k||(D=setTimeout(m,y))}function r(){D&&(clearTimeout(D),D=null)}function c(e){g||e.metaKey&&76===e.keyCode&&(g=!0,D=setTimeout(m,y))}function d(e,n){return a()[e]===n}function a(){for(var e=document.cookie.split("; "),n={},o=e.length-1;o>=0;o--){var i=e[o].split("=");n[i[0]]=i[1]}return n}function s(){return d(T,"true")&&!v}function m(){s()||(e&&(e.style.display="block"),E(),f())}function f(e){var n=e||{};"undefined"!=typeof n.cookieExpire&&(b=i(n.cookieExpire)),n.sitewide===!0&&(w=";path=/"),"undefined"!=typeof n.cookieDomain&&(x=";domain="+n.cookieDomain),"undefined"!=typeof n.cookieName&&(T=n.cookieName),document.cookie=T+"=true"+b+x+w,L.removeEventListener("mouseleave",u),L.removeEventListener("mouseenter",r),L.removeEventListener("keydown",c)}var l=n||{},v=l.aggressive||!1,k=o(l.sensitivity,20),p=o(l.timer,1e3),y=o(l.delay,0),E=l.callback||function(){},b=i(l.cookieExpire)||"",x=l.cookieDomain?";domain="+l.cookieDomain:"",T=l.cookieName?l.cookieName:"viewedOuibounceModal",w=l.sitewide===!0?";path=/":"",D=null,L=document.documentElement;setTimeout(t,p);var g=!1;return{fire:m,disable:f,isDisabled:s}}});
;/*})'"*/
;/*})'"*/
jQuery(document).ready(function() {
    // tips_cookie daily tips cookie ran until 12/18/2014
    // air2_splash ipad air 2 contest running 12/18/2014 - 1/3/2015
    // tips_2_cookie set 1/14/2015
    // 2015_april_tips // daily tips
    // 2015_may_tips // daily tips
    // tips_cookie_dec2015 // dailytips
    // zinio_contest_cookie // Aug 2015
    jtoken = 'tips_cookie_apr2016';// 'tips_cookie';
    splash = jQuery.jStorage.get(jtoken); 

    /*
     * If it's mobile, don't show mangosplash,instead inject hellobar
     */

    var mangosplashDefaultConfig = {
      eventLabel: "dailytips",
      splashObject: {
          items: {
            src: '//www.iphonelife.com/dailytips/mobiletest.php',
          },
          type: 'ajax',
          alignTop: true,
          closeOnContentClick: false,
          showCloseBtn:true,
          cloeBtnInside:true,
          closeOnBgClick: true
      }
    };

    if(!window.mangosplashConfig) {
        window.mangosplashConfig = mangosplashDefaultConfig;
        console.log("we have no override, use default config");
    }

    // set up link clicks
    jQuery(".splash-trigger").click(function(e) {
        jQuery.magnificPopup.open(window.mangosplashConfig.splashObject);
        window.mangosplashConfig.shown = true;
        e.preventDefault();
    });

    if(splash == null) {
        // set the splash storage key, and display the splash page
        jQuery.jStorage.set(jtoken, true);
        jQuery.jStorage.setTTL(jtoken, 604800000); // 7000 days, i.e don't expire
        // also see confirmation to set timeout before showing again once someone is on the list
        // Contest 
        // src: '//www.iphonelife.com/giveaway/newipadair2/enter/splash',

      setTimeout(function() {
        if(!window.mangosplashConfig.shown) {
          // show default splash if desktop
          // do something else if it's mobile
          if (/Mobi/.test(navigator.userAgent)) {
              ga('send', 'event', { eventCategory: 'hello-offer', eventAction: 'display', eventLabel: "hello-offer-footer"});
              var offerVariant = 'default';
              window.snowplow('trackStructEvent', 'lead-conversion', 'show-offer', 'hello-offer-footer', offerVariant);

              jQuery.get('//www.iphonelife.com/dailytips/mobile-footer-offer.html', function(data){
                  jQuery("body").append(data);
              });
          } else {
            jQuery.magnificPopup.open(window.mangosplashConfig.splashObject);
            console.log("pop splash with config: " + window.mangosplashConfig.eventLabel);
            ga('send', 'event', { eventCategory: 'splash', eventAction: 'display', eventLabel: window.mangosplashConfig.eventLabel});
            window.snowplow('trackStructEvent', 'lead-conversion', 'show-offer', 'splash', window.mangosplashConfig.eventLabel);
          }
        }

        // Contest Splash
          /*
        jQuery.magnificPopup.open({
                  items: {
                    src: '//www.iphonelife.com/giveaway/newipadpro/enter/splash',
                  },
                  type: 'ajax',
                  alignTop: true,
                  closeOnContentClick: false,
                  showCloseBtn:true,
                  cloeBtnInside:true,
                  closeOnBgClick: true
                });

        ga('send', 'event', { eventCategory: 'splash', eventAction: 'display', eventLabel: 'ipad-pro-contest'});
        */
      }, 5000);

    /*
    setTimeout(
      function() {  
        // daily tips 
         $.colorbox({href:"http://www.iphonelife.com/dailytips/?splash=1", iframe:true, scrolling:false, top:"0px", left:"0px", reposition:false, width:"800", height:"600"});

	// insider program
        // $.colorbox({href:"http://www.iphonelife.com/splash/insider.html", iframe:true, scrolling:false, top:"0px", left:"0px", reposition:false, width:"670", height:"790"});

        // contest
        // $.colorbox({href:"http://www.iphonelife.com/giveaway/applewatch/enter/splash", className: 'contestSplash', iframe:true, scrolling:false, top:"0px", left:"0px", reposition:false, width:"725", height:"880"});
        }, 6000
      );
      */

    console.log("launch splash, hasn't been shown yet"); 
    window.triggerVWOTest = true;
  } else {

    if(jQuery.jStorage.get("isAdmin")) {
    console.log("admin cookie set, pop mobile footer offer"); 
      ga('send', 'event', { eventCategory: 'hello-offer', eventAction: 'display', eventLabel: "hello-offer-footer"});
      jQuery.get('//www.iphonelife.com/dailytips/mobile-footer-offer.html', function(data){
          jQuery("body").append(data);
      });
    }
    console.log("no splash, it's been shown"); 
  }

  /*
  console.log("define ouibounce");
    var splash_cb = function(source) {
        jQuery.magnificPopup.open({
          items: {
            src: '//www.iphonelife.com/dailytips/exit.php?exitsplash=1',
          },
          type: 'ajax',
          alignTop: true,
          closeOnContentClick: false,
          showCloseBtn:true,
          cloeBtnInside:true,
          closeOnBgClick: true
        });

        ga('send', 'event', { eventCategory: 'exit_splash', eventAction: 'display'});
    }

    var _ouibounce = ouibounce(false, {
        callback: splash_cb,
        // aggressive: true
        // ddaggressive: true
    });
*/
});

;/*})'"*/
;/*})'"*/
(function($) {
  Drupal.behaviors.custom_search = {
    attach: function(context) {

      if (!Drupal.settings.custom_search.solr) {
        // Check if the search box is not empty on submit
        $('form.search-form', context).submit(function(){
          var $this = $(this);
          var box = $this.find('input.custom-search-box');
          if (box.val() != undefined && box.val() == '') {
            $this.find('input.custom-search-box').addClass('error');
            return false;
          }
          // If basic search is hidden, copy or value to the keys
          if ($this.find('#edit-keys').parents('div.element-invisible').attr('class') == 'element-invisible') {
            $this.find('#edit-keys').val($this.find('#edit-or').val());
            $this.find('#edit-or').val('');
          }
          return true;
        });
      }

      // Search from target
      $('form.search-form').attr('target', Drupal.settings.custom_search.form_target);

      // Displays Popup.
      $('form.search-form input.custom-search-box', context).bind('click focus', function(e){
        var $parentForm = $(this).parents('form');
        // check if there's something in the popup and displays it
        var popup = $parentForm.find('fieldset.custom_search-popup');
        if (popup.find('input,select').length && !popup.hasClass('opened')) {
          popup.fadeIn().addClass('opened');
        }
        e.stopPropagation();
      });
      $(document).bind('click focus', function(){
        $('fieldset.custom_search-popup').hide().removeClass('opened');
      });

      // Handle checkboxes
      $('.custom-search-selector input:checkbox', context).each(function(){
        var el = $(this);
        if (el.val() == 'c-all') {
          el.change(function(){
            $(this).parents('.custom-search-selector').find('input:checkbox[value!=c-all]').attr('checked', false);
          });
        }
        else {
          if (el.val().substr(0,2) == 'c-') {
            el.change(function(){
              $('.custom-search-selector input:checkbox').each(function(){
                if ($(this).val().substr(0,2) == 'o-') {
                  $(this).attr('checked', false);
                }
              });
              $(this).parents('.custom-search-selector').find('input:checkbox[value=c-all]').attr('checked', false);
            });
          } else {
            el.change(function(){
              $(this).parents('.custom-search-selector').find('input:checkbox[value!=' + el.val() + ']').attr('checked', false);
            });
          }
        }
      });

      // Reselect types and terms in advanced search
      var edit_keys = encodeURIComponent($('#edit-keys').val());

      if (edit_keys) {
        // types
        var pos = edit_keys.indexOf('type:');
        if (pos != -1) {
          var pos2 = edit_keys.indexOf(' ', pos);
          if (pos2 == -1) {
            pos2 = edit_keys.length;
          }
          var types = edit_keys.substring(pos + 5,pos2);
          types = types.split(',');
          for (var i = 0; i < types.length; i++) {
            $('.search-form input:checkbox[value=' + types[i] + ']').attr('checked', true);
          }
        }
        // terms
        var pos = edit_keys.indexOf('term:');
        if (pos != -1) {
          var pos2 = edit_keys.indexOf(' ', pos);
          if (pos2 == -1) {
            pos2 = edit_keys.length;
          }
          var terms = edit_keys.substring(pos + 5, pos2);
          terms = terms.split(',');
          for (var i = 0; i < terms.length; i++) {
            $('#edit-term option[value=' + terms[i] + ']').attr('selected', true);
          }
        }
        // languages
        var pos = edit_keys.indexOf('language:');
        if (pos != -1) {
          var pos2 = edit_keys.indexOf(' ', pos);
          if (pos2 == -1) {
            pos2 = edit_keys.length;
          }
          var languages = edit_keys.substring(pos + 9,pos2);
          languages = languages.split(',');
          for (var i = 0; i < languages.length; i++) {
            $('.search-advanced #edit-language-' + languages[i]).attr('checked', true);
          }
        }
      }

      var popup = $('fieldset.custom_search-popup:not(.custom_search-processed)', context).addClass("custom_search-processed");
      popup.click(function(e){
        e.stopPropagation();
      })
      popup.append('<a class="custom_search-popup-close" href="#">' + Drupal.t('Close') + '</a>');
      $('a.custom_search-popup-close').click(function(e){
        $('fieldset.custom_search-popup.opened').hide().removeClass('opened');
        e.preventDefault();
      });

    }
  }
})(jQuery);

;/*})'"*/
;/*})'"*/
/**
 * @file
 * Simple responsification of menus.
 */
(function ($) {
  /**
   * Handle clicks & toggling the menu.
   */
  var toggler_click = function() {
    $(this).parent().toggleClass('responsive-toggled');
  };
  /**
   * Unbind other mouse events on the menu items.
   *
   * @todo
   *   Not sure if it works 100%.
   *   Doesn't restore binds when out-of-responsive (if window dragging).
   */
  function remove_mouse_events(menuElement) {
    // Determine jQuery version and what disable options we have.
    var jqVersion = $.fn.jquery;
    if (jqVersion < 1.7) {
      $(menuElement).die('mouseover mouseout mouseenter mouseleave');
      $(menuElement + ' li').die('mouseover mouseout mouseenter mouseleave');
      $(menuElement + ' li a').die('mouseover mouseout mouseenter mouseleave');
    }
    else {
      $(menuElement).off('hover');
      $(menuElement + ' li').off('hover');
      $(menuElement + ' li a').off('hover');
    }
    $(menuElement).unbind('mouseover mouseout mouseenter mouseleave');
    $(menuElement + ' li').unbind('mouseover mouseout mouseenter mouseleave');
    $(menuElement + ' li a').unbind('mouseover mouseout mouseenter mouseleave');
  }

  /**
   * Store classes & IDs for restoring later (if window dragging).
   */
  function store_classes_ids(menuElement) {
    if (!$(menuElement).attr('id')) {
      $(menuElement).attr('id', 'rm-no-id');
    }
    if (!$(menuElement).attr('class')) {
      $(menuElement).attr('class', 'rm-no-class');
    }
    $(menuElement).data('removeattr', true)
      .data('rmids', $(menuElement).attr('id'))
      .data('rmclasses', $(menuElement).attr('class'));
    // Handle ULs if selector is parent div.
    $(menuElement).find('ul').each(function() {
      // Prevent error if there is no id.
      if (!$(this).attr('id')) {
        $(this).attr('id', 'rm-no-id');
      }
      // Prevent error if there is no class.
      if (!$(this).attr('class')) {
        $(this).attr('class', 'rm-no-class');
      }
      $(this).data('removeattr', true)
        .data('rmids', $(this).attr('id'))
        .data('rmclasses', $(this).attr('class'));
    });
    // Finally, add our class to the parent.
    $(menuElement).addClass('responsive-menus-simple');
  }

  /**
   * Remove classes & IDs from original menu for easier theming.
   */
  function remove_classes_ids(menuElement) {
    // Handle ULs if selector is parent div.
    $(menuElement).find('ul').each(function() {
      $(this).attr('class', 'rm-removed').attr('id', 'rm-removed');
    });
    // Remove classes/IDs.
    $(menuElement).attr('class', 'responsive-menus-simple').attr('id', 'rm-removed');
  }

  // Iterate through selectors, check window sizes, add some classes.
  Drupal.behaviors.responsive_menus = {
    attach: function (context, settings) {
      settings.responsive_menus = settings.responsive_menus || {};
      $('body').once('responsive-menus-load', function() {
        // Only doing this themes that don't include a viewport attribute.
        // e.g. Bartik for testing out-of-the-box... yeah, stupid.
        if (!$('meta[name=viewport]').length > 0) {
          $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1.0">');
        }
        // Window width with legacy browsers.
        var windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
        $.each(settings.responsive_menus, function(ind, iteration) {
          if (iteration.responsive_menus_style != 'responsive_menus_simple') {
            return true;
          }
          if (!iteration.selectors.length) {
            return true;
          }
          var $media_size = iteration.media_size || 768;
          // Handle clicks & toggling.
          var toggler_class = '';
          var toggler_text = iteration.toggler_text;
          // Iterate through our selectors.
          $.each(iteration.selectors, function(index, value) {
            // Stop if there is no menu element.
            if ($(value).length < 1) {
              return true;
            }
            // Handle nested menus.  Make sure we get the first, but not children.
            if ($(value).length > 1) {
              $(value).each(function(val_index) {
                if (!$(this).parents('ul').length) {
                  if (!$(this).hasClass('responsive-menus-simple')) {
                    toggler_class = 'responsive-menus-' + ind + '-' + index + '-' + val_index;
                    // Store classes & IDs before removing.
                    if (iteration.remove_attributes) {
                      store_classes_ids(this);
                    }
                    $(this).wrap('<div data-mediasize="' + $media_size + '" class="responsive-menus ' + toggler_class + '" />');
                    $('.' + toggler_class).prepend('<span class="toggler">' + toggler_text + '</span>');
                    $('.' + toggler_class + ' .toggler').bind('click', toggler_click);
                    // Unbind other mouse events.
                    if (iteration.disable_mouse_events) {
                      //$(this).data('disablemouse', true);
                      remove_mouse_events(this);
                    }
                    // Use absolute positioning.
                    if (iteration.absolute) {
                      $('.' + toggler_class).addClass('absolute');
                    }
                    // Handle first size check.
                    if (windowWidth <= $media_size) {
                      // Remove attributes setting.
                      if (iteration.remove_attributes) {
                        remove_classes_ids(this);
                      }
                      $('.' + toggler_class).addClass('responsified');
                    }
                  }
                }
              });
            }
            else {
              // Single level menus.
              if (!$(value).hasClass('responsive-menus-simple')) {
                toggler_class = 'responsive-menus-' + ind + '-' + index;
                // Store classes & IDs before removing.
                if (iteration.remove_attributes) {
                  store_classes_ids(value);
                }
                $(value).wrap('<div data-mediasize="' + $media_size + '" class="responsive-menus ' + toggler_class + '" />');
                $('.' + toggler_class).prepend('<span class="toggler">' + toggler_text + '</span>');
                $('.' + toggler_class + ' .toggler').bind('click', toggler_click);
                // Unbind other mouse events.
                if (iteration.disable_mouse_events) {
                  // @todo For rebinding mouse events.
                  /*if ($(value + ' li a').data('events')) {
                    $(value).data('tmpevents', $(value + ' li a').data('events'));
                  }*/
                  remove_mouse_events(value);
                }
                // Use absolute positioning.
                if (iteration.absolute) {
                  $('.' + toggler_class).addClass('absolute');
                }
                // Handle first size check.
                if (windowWidth <= $media_size) {
                  // Remove attributes setting.
                  if (iteration.remove_attributes) {
                    remove_classes_ids(value);
                  }
                  $('.' + toggler_class).addClass('responsified');
                }
              }
            }
          });
       });
        // Handle window resizing.
        $(window).resize(function() {
          // Window width with legacy browsers.
          windowWidth = document.documentElement.clientWidth || document.body.clientWidth;
          $('.responsive-menus').each(function(menuIndex, menuValue) {
            var mediasize = $(this).data('mediasize') || 768;
            // Prevent menu from going off the screen.  This only happens in
            // non-responsive themes (like Bartik default), but it looks bad.
            if ($(this).width() > windowWidth) {
              $(this).data('nonresponsive', true);
              $(this).width(windowWidth);
            }
            var menuElement = $(this).find('.responsive-menus-simple');
            if (windowWidth >= mediasize) {
              if (menuElement.data('removeattr')) {
                menuElement.addClass(menuElement.data('rmclasses'));
                menuElement.attr('id', menuElement.data('rmids'));
                menuElement.find('ul').each(function() {
                  $(this).addClass($(this).data('rmclasses'));
                  $(this).attr('id', $(this).data('rmids'));
                });
              }
              $(this).removeClass('responsified');
            }
            if (windowWidth <= mediasize) {
              // Now fix repercussions for handling non-responsive themes above.
              // Stretch width back out w/ the screen.
              if ($(this).data('nonresponsive') && $(this).width() < windowWidth) {
                $(this).width(windowWidth);
              }
              if (menuElement.data('removeattr')) {
                remove_classes_ids(menuElement);
              }
              $(this).addClass('responsified');
            }
          });
          var viewportWidth = $(window).width();
          if(viewportWidth > 768) {
            $('#drawer__top').remove();
            $('#block-search-form').show();
          }
        });
      });
    }
  };

}(jQuery));

;/*})'"*/
;/*})'"*/
(function ($) {

Drupal.googleanalytics = {};

$(document).ready(function() {

  // Attach mousedown, keyup, touchstart events to document only and catch
  // clicks on all elements.
  $(document.body).bind("mousedown keyup touchstart", function(event) {

    // Catch the closest surrounding link of a clicked element.
    $(event.target).closest("a,area").each(function() {

      // Is the clicked URL internal?
      if (Drupal.googleanalytics.isInternal(this.href)) {
        // Skip 'click' tracking, if custom tracking events are bound.
        if ($(this).is('.colorbox') && (Drupal.settings.googleanalytics.trackColorbox)) {
          // Do nothing here. The custom event will handle all tracking.
          //console.info("Click on .colorbox item has been detected.");
        }
        // Is download tracking activated and the file extension configured for download tracking?
        else if (Drupal.settings.googleanalytics.trackDownload && Drupal.googleanalytics.isDownload(this.href)) {
          // Download link clicked.
          ga("send", {
            "hitType": "event",
            "eventCategory": "Downloads",
            "eventAction": Drupal.googleanalytics.getDownloadExtension(this.href).toUpperCase(),
            "eventLabel": Drupal.googleanalytics.getPageUrl(this.href),
            "transport": "beacon"
          });
        }
        else if (Drupal.googleanalytics.isInternalSpecial(this.href)) {
          // Keep the internal URL for Google Analytics website overlay intact.
          ga("send", {
            "hitType": "pageview",
            "page": Drupal.googleanalytics.getPageUrl(this.href),
            "transport": "beacon"
          });
        }
      }
      else {
        if (Drupal.settings.googleanalytics.trackMailto && $(this).is("a[href^='mailto:'],area[href^='mailto:']")) {
          // Mailto link clicked.
          ga("send", {
            "hitType": "event",
            "eventCategory": "Mails",
            "eventAction": "Click",
            "eventLabel": this.href.substring(7),
            "transport": "beacon"
          });
        }
        else if (Drupal.settings.googleanalytics.trackOutbound && this.href.match(/^\w+:\/\//i)) {
          if (Drupal.settings.googleanalytics.trackDomainMode !== 2 || (Drupal.settings.googleanalytics.trackDomainMode === 2 && !Drupal.googleanalytics.isCrossDomain(this.hostname, Drupal.settings.googleanalytics.trackCrossDomains))) {
            // External link clicked / No top-level cross domain clicked.
            ga("send", {
              "hitType": "event",
              "eventCategory": "Outbound links",
              "eventAction": "Click",
              "eventLabel": this.href,
              "transport": "beacon"
            });
          }
        }
      }
    });
  });

  // Track hash changes as unique pageviews, if this option has been enabled.
  if (Drupal.settings.googleanalytics.trackUrlFragments) {
    window.onhashchange = function() {
      ga("send", {
        "hitType": "pageview",
        "page": location.pathname + location.search + location.hash
      });
    };
  }

  // Colorbox: This event triggers when the transition has completed and the
  // newly loaded content has been revealed.
  if (Drupal.settings.googleanalytics.trackColorbox) {
    $(document).bind("cbox_complete", function () {
      var href = $.colorbox.element().attr("href");
      if (href) {
        ga("send", {
          "hitType": "pageview",
          "page": Drupal.googleanalytics.getPageUrl(href)
        });
      }
    });
  }

});

/**
 * Check whether the hostname is part of the cross domains or not.
 *
 * @param string hostname
 *   The hostname of the clicked URL.
 * @param array crossDomains
 *   All cross domain hostnames as JS array.
 *
 * @return boolean
 */
Drupal.googleanalytics.isCrossDomain = function (hostname, crossDomains) {
  /**
   * jQuery < 1.6.3 bug: $.inArray crushes IE6 and Chrome if second argument is
   * `null` or `undefined`, http://bugs.jquery.com/ticket/10076,
   * https://github.com/jquery/jquery/commit/a839af034db2bd934e4d4fa6758a3fed8de74174
   *
   * @todo: Remove/Refactor in D8
   */
  if (!crossDomains) {
    return false;
  }
  else {
    return $.inArray(hostname, crossDomains) > -1 ? true : false;
  }
};

/**
 * Check whether this is a download URL or not.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isDownload = function (url) {
  var isDownload = new RegExp("\\.(" + Drupal.settings.googleanalytics.trackDownloadExtensions + ")([\?#].*)?$", "i");
  return isDownload.test(url);
};

/**
 * Check whether this is an absolute internal URL or not.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isInternal = function (url) {
  var isInternal = new RegExp("^(https?):\/\/" + window.location.host, "i");
  return isInternal.test(url);
};

/**
 * Check whether this is a special URL or not.
 *
 * URL types:
 *  - gotwo.module /go/* links.
 *
 * @param string url
 *   The web url to check.
 *
 * @return boolean
 */
Drupal.googleanalytics.isInternalSpecial = function (url) {
  var isInternalSpecial = new RegExp("(\/go\/.*)$", "i");
  return isInternalSpecial.test(url);
};

/**
 * Extract the relative internal URL from an absolute internal URL.
 *
 * Examples:
 * - http://mydomain.com/node/1 -> /node/1
 * - http://example.com/foo/bar -> http://example.com/foo/bar
 *
 * @param string url
 *   The web url to check.
 *
 * @return string
 *   Internal website URL
 */
Drupal.googleanalytics.getPageUrl = function (url) {
  var extractInternalUrl = new RegExp("^(https?):\/\/" + window.location.host, "i");
  return url.replace(extractInternalUrl, '');
};

/**
 * Extract the download file extension from the URL.
 *
 * @param string url
 *   The web url to check.
 *
 * @return string
 *   The file extension of the passed url. e.g. "zip", "txt"
 */
Drupal.googleanalytics.getDownloadExtension = function (url) {
  var extractDownloadextension = new RegExp("\\.(" + Drupal.settings.googleanalytics.trackDownloadExtensions + ")([\?#].*)?$", "i");
  var extension = extractDownloadextension.exec(url);
  return (extension === null) ? '' : extension[1];
};

})(jQuery);

;/*})'"*/
;/*})'"*/
(function ($) {
Drupal.behaviors.radioactivity = {

  config: '',
  attached: false,
  activeIncidents: [],

  attach: function (context, settings) {

    // Skip if radioactivity is not set
    if (typeof settings.radioactivity == 'undefined') {
      return;
    }

    var config = settings.radioactivity.config;
    var emitters = settings.radioactivity.emitters;
    
    // Clear used emitters
    settings.radioactivity.emitters = []; 

    this.config = config;

    $.each(emitters, function(callback, incidents) {

      // Accuracy and  flood filtering
      $.each(incidents, function(index, incident) {

        var config = Drupal.behaviors.radioactivity.config;
        var key = 'radioactivity_' + incident['checksum'];

        // Flood protection (cookie based)
        if (config.fpEnabled) {  
          if (Drupal.behaviors.radioactivity.fetch(key)) {
            // Filter
            return;
          } else {
            var exp = new Date();
            exp.setTime(exp.getTime() + (config.fpTimeout * 60 * 1000));
            Drupal.behaviors.radioactivity.store(key, true, exp);
          }
        } else {
          // clear the possible cookie
          Drupal.behaviors.radioactivity.store(key, null, new Date());
          //$.cookie(key, null);
        }

        // Accuracy filtering
        var rnd = Math.random() * 100;
        if (rnd >= incident.accuracy) {
          return;
        }

        Drupal.behaviors.radioactivity.activeIncidents.push(incident);
      });

      // Call the emitter callback
      if (Drupal.behaviors.radioactivity.activeIncidents.length > 0) {
        Drupal.behaviors.radioactivity[callback](Drupal.behaviors.radioactivity.activeIncidents);
        // Clear incidents
        Drupal.behaviors.radioactivity.activeIncidents = [];
      }
    });
  },

  hardStore: function (key, value, exp) {
    try {
      if (typeof(Storage) !== "undefined") {
        localStorage.setItem(key, JSON.stringify({
          value: value,
          expire: exp.getTime()
        }));
        sessionStorage.setItem(key, JSON.stringify({
          value: value,
          expire: exp.getTime()
        }));      
      }
    } catch(e){
      $.cookie(key, value, { expires: exp });
    }
    $.cookie(key, value, { expires: exp });
  },

  hardFetch: function (key) {
    var data = null;
    if (typeof(Storage) !== "undefined") {
      try{
        data = localStorage.getItem(key)
        if (!data) {
          data = sessionStorage.getItem(key);
        }
      } catch(e){
        
      }
    }
    if (!data) {
      data = $.cookie(key);
    }
    return data;
  },

  store: function (key, value, exp) {
    //return this.hardStore(key, value, exp);
    if (typeof(Storage) !== "undefined") {
      // Fall back to using cookies if this fails
      try {
        localStorage.setItem(key, JSON.stringify({
          value: value,
          expire: exp.getTime()
        }));
      } catch(e) {
        $.cookie(key, value, { expires: exp });
      }
    } else {
      $.cookie(key, value, { expires: exp });
    }
  },

  fetch: function (key) {
    var now = new Date();
    if (typeof(Storage) !== "undefined") {
      // Fall back to using cookies if this fails
      try {
        var data = localStorage.getItem(key);
        if (data) {
          data = JSON.parse(data);
          if (now.getTime() < data.expire) {
            return data.value;
          }
        }
        return null;
      } catch(e) {
        return $.cookie(key);
      }
    }
    return $.cookie(key);
  },

  emitDefault: function (incidents) {
    $.ajax({
      url: this.config.emitPath,
      data: {'incidents': incidents},
      type: 'POST',
      cache: false,
      dataType: "html"
    });
  }
};
})(jQuery);

;/*})'"*/
;/*})'"*/
/**
 * @file
 * JavaScript for the Disqus Drupal module.
 */

// The Disqus global variables.
var disqus_shortname = '';
var disqus_url = '';
var disqus_title = '';
var disqus_identifier = '';
var disqus_developer = 0;
var disqus_def_name = '';
var disqus_def_email = '';
var disqus_config;

(function ($) {

/**
 * Drupal Disqus behavior.
 */
Drupal.behaviors.disqus = {
  attach: function (context, settings) {
    $('body').once('disqus', function() {
      // Load the Disqus comments.
      if (settings.disqus || false) {
        // Setup the global JavaScript variables for Disqus.
        disqus_shortname = settings.disqus.domain;
        disqus_url = settings.disqus.url;
        disqus_title = settings.disqus.title;
        disqus_identifier = settings.disqus.identifier;
        disqus_developer = settings.disqus.developer || 0;
        disqus_def_name = settings.disqus.name || '';
        disqus_def_email = settings.disqus.email || '';

        // Language and SSO settings are passed in through disqus_config().
        disqus_config = function() {
          if (settings.disqus.language || false) {
            this.language = settings.disqus.language;
          }
          if (settings.disqus.remote_auth_s3 || false) {
            this.page.remote_auth_s3 = settings.disqus.remote_auth_s3;
          }
          if (settings.disqus.api_key || false) {
            this.page.api_key = settings.disqus.api_key;
          }
          if (settings.disqus.sso || false) {
            this.sso = settings.disqus.sso;
          }
          if (settings.disqus.callbacks || false) {
            for (var key in settings.disqus.callbacks) {
              for (var i = 0; i < settings.disqus.callbacks[key].length; i++) {
                var callback = settings.disqus.callbacks[key][i].split('.');
                var fn = window;
                for (var j = 0; j < callback.length; j++) {
                  fn = fn[callback[j]];
                }
                if(typeof fn === 'function') {
                  this.callbacks[key].push(fn);
                }
              }
            }
          }
        };

        // Make the AJAX call to get the Disqus comments.
        jQuery.ajax({
          type: 'GET',
          url: '//' + disqus_shortname + '.disqus.com/embed.js',
          dataType: 'script',
          cache: false
        });
      }

      // Load the comment numbers JavaScript.
      if (settings.disqusComments || false) {
        disqus_shortname = settings.disqusComments;
        // Make the AJAX call to get the number of comments.
        jQuery.ajax({
          type: 'GET',
          url: '//' + disqus_shortname + '.disqus.com/count.js',
          dataType: 'script',
          cache: false
        });
      }
    });
  }
};

})(jQuery);

;/*})'"*/
;/*})'"*/
(function ($) {

  /**
   * The recommended way for producing HTML markup through JavaScript is to write
   * theming functions. These are similiar to the theming functions that you might
   * know from 'phptemplate' (the default PHP templating engine used by most
   * Drupal themes including Omega). JavaScript theme functions accept arguments
   * and can be overriden by sub-themes.
   *
   * In most cases, there is no good reason to NOT wrap your markup producing
   * JavaScript in a theme function.
   */
  Drupal.theme.prototype.newmangoExampleButton = function (path, title) {
    // Create an anchor element with jQuery.
    return $('<a href="' + path + '" title="' + title + '">' + title + '</a>');
  };

  /**
   * Behaviors are Drupal's way of applying JavaScript to a page. The advantage
   * of behaviors over simIn short, the advantage of Behaviors over a simple
   * document.ready() lies in how it interacts with content loaded through Ajax.
   * Opposed to the 'document.ready()' event which is only fired once when the
   * page is initially loaded, behaviors get re-executed whenever something is
   * added to the page through Ajax.
   *
   * You can attach as many behaviors as you wish. In fact, instead of overloading
   * a single behavior with multiple, completely unrelated tasks you should create
   * a separate behavior for every separate task.
   *
   * In most cases, there is no good reason to NOT wrap your JavaScript code in a
   * behavior.
   *
   * @param context
   *   The context for which the behavior is being executed. This is either the
   *   full page or a piece of HTML that was just added through Ajax.
   * @param settings
   *   An array of settings (added through drupal_add_js()). Instead of accessing
   *   Drupal.settings directly you should use this because of potential
   *   modifications made by the Ajax callback that also produced 'context'.
   */

  /*
  Drupal.behaviors.newmangoExampleBehavior = {
    attach: function (context, settings) {
      // By using the 'context' variable we make sure that our code only runs on
      // the relevant HTML. Furthermore, by using jQuery.once() we make sure that
      // we don't run the same piece of code for an HTML snippet that we already
      // processed previously. By using .once('foo') all processed elements will
      // get tagged with a 'foo-processed' class, causing all future invocations
      // of this behavior to ignore them.
      $('.some-selector', context).once('foo', function () {
        // Now, we are invoking the previously declared theme function using two
        // settings as arguments.
        var $anchor = Drupal.theme('newmangoExampleButton', settings.myExampleLinkPath, settings.myExampleLinkTitle);

        // The anchor is then appended to the current element.
        $anchor.appendTo(this);
      });
    }
  };
  */

  $(document).ready(function() {
      $(".search-icon").click(function(){

       if($("#block-search-form").is(':visible'))
       {
           $("#block-search-form").hide();
       }
       else{
           $("#block-search-form").show();
       }
      });

      $('.nav-container .toggler').click(function(){
          $('body').addClass('js-drawer-open');
          $('#rm-removed.responsive-menus-simple').addClass('show-block');
          $('#rm-removed ul').prepend('<div id="drawer__top">' +
              '<div class="marketing-nav__logo"><a href="/" class="marketing-nav__logo__iphoneLife"><img src="/sites/all/themes/newmango/images/IPL_logo_white.svg" alt="logo svg"></a></div>' +
              '<div class="marketing-nav_close_icon"><a id="close-icon" class="drawer__close-button js-drawer-close" aria-hidden="true"><img src="/sites/all/themes/newmango/images/IPL_close-icon.svg" alt="close svg"></a></div>'
          );
          $('#close-icon').click(function(){
              $(this).remove();
              $('#rm-removed.responsive-menus-simple').removeClass('show-block');
              $('#drawer__top').remove();
              $('#rm-removed').parent().removeClass('responsive-toggled');
              $('body').removeClass('js-drawer-open');
          });
      });
  });

})(jQuery);


;/*})'"*/
;/*})'"*/
/** sourcebuster v1.1.0 **/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var t;"undefined"!=typeof window?t=window:"undefined"!=typeof global?t=global:"undefined"!=typeof self&&(t=self),t.sbjs=e()}}(function(){return function e(t,r,n){function s(a,o){if(!r[a]){if(!t[a]){var c="function"==typeof require&&require;if(!o&&c)return c(a,!0);if(i)return i(a,!0);var u=new Error("Cannot find module '"+a+"'");throw u.code="MODULE_NOT_FOUND",u}var p=r[a]={exports:{}};t[a][0].call(p.exports,function(e){var r=t[a][1][e];return s(r?r:e)},p,p.exports,e,t,r,n)}return r[a].exports}for(var i="function"==typeof require&&require,a=0;a<n.length;a++)s(n[a]);return s}({1:[function(e,t,r){"use strict";var n=e("./init"),s={init:function(e){this.get=n(e),e&&e.callback&&"function"==typeof e.callback&&e.callback(this.get)}};t.exports=s},{"./init":6}],2:[function(e,t,r){"use strict";var n=e("./terms"),s=e("./helpers/utils"),i={containers:{current:"sbjs_current",current_extra:"sbjs_current_add",first:"sbjs_first",first_extra:"sbjs_first_add",session:"sbjs_session",udata:"sbjs_udata",promocode:"sbjs_promo"},service:{migrations:"sbjs_migrations"},delimiter:"|||",aliases:{main:{type:"typ",source:"src",medium:"mdm",campaign:"cmp",content:"cnt",term:"trm"},extra:{fire_date:"fd",entrance_point:"ep",referer:"rf"},session:{pages_seen:"pgs",current_page:"cpg"},udata:{visits:"vst",ip:"uip",agent:"uag"},promo:"code"},pack:{main:function(e){return i.aliases.main.type+"="+e.type+i.delimiter+i.aliases.main.source+"="+e.source+i.delimiter+i.aliases.main.medium+"="+e.medium+i.delimiter+i.aliases.main.campaign+"="+e.campaign+i.delimiter+i.aliases.main.content+"="+e.content+i.delimiter+i.aliases.main.term+"="+e.term},extra:function(e){return i.aliases.extra.fire_date+"="+s.setDate(new Date,e)+i.delimiter+i.aliases.extra.entrance_point+"="+document.location.href+i.delimiter+i.aliases.extra.referer+"="+(document.referrer||n.none)},user:function(e,t){return i.aliases.udata.visits+"="+e+i.delimiter+i.aliases.udata.ip+"="+t+i.delimiter+i.aliases.udata.agent+"="+navigator.userAgent},session:function(e){return i.aliases.session.pages_seen+"="+e+i.delimiter+i.aliases.session.current_page+"="+document.location.href},promo:function(e){return i.aliases.promo+"="+s.setLeadingZeroToInt(s.randomInt(e.min,e.max),e.max.toString().length)}}};t.exports=i},{"./helpers/utils":5,"./terms":9}],3:[function(e,t,r){"use strict";var n=e("../data").delimiter;t.exports={encodeData:function(e){return encodeURIComponent(e).replace(/\!/g,"%21").replace(/\~/g,"%7E").replace(/\*/g,"%2A").replace(/\'/g,"%27").replace(/\(/g,"%28").replace(/\)/g,"%29")},decodeData:function(e){try{return decodeURIComponent(e).replace(/\%21/g,"!").replace(/\%7E/g,"~").replace(/\%2A/g,"*").replace(/\%27/g,"'").replace(/\%28/g,"(").replace(/\%29/g,")")}catch(t){try{return unescape(e)}catch(r){return""}}},set:function(e,t,r,n,s){var i,a;if(r){var o=new Date;o.setTime(o.getTime()+60*r*1e3),i="; expires="+o.toGMTString()}else i="";a=n&&!s?";domain=."+n:"",document.cookie=this.encodeData(e)+"="+this.encodeData(t)+i+a+"; path=/"},get:function(e){for(var t=this.encodeData(e)+"=",r=document.cookie.split(";"),n=0;n<r.length;n++){for(var s=r[n];" "===s.charAt(0);)s=s.substring(1,s.length);if(0===s.indexOf(t))return this.decodeData(s.substring(t.length,s.length))}return null},destroy:function(e,t,r){this.set(e,"",-1,t,r)},parse:function(e){var t=[],r={};if("string"==typeof e)t.push(e);else for(var s in e)e.hasOwnProperty(s)&&t.push(e[s]);for(var i=0;i<t.length;i++){var a;r[this.unsbjs(t[i])]={},a=this.get(t[i])?this.get(t[i]).split(n):[];for(var o=0;o<a.length;o++){var c=a[o].split("="),u=c.splice(0,1);u.push(c.join("=")),r[this.unsbjs(t[i])][u[0]]=this.decodeData(u[1])}}return r},unsbjs:function(e){return e.replace("sbjs_","")}}},{"../data":2}],4:[function(e,t,r){"use strict";t.exports={parse:function(e){for(var t=this.parseOptions,r=t.parser[t.strictMode?"strict":"loose"].exec(e),n={},s=14;s--;)n[t.key[s]]=r[s]||"";return n[t.q.name]={},n[t.key[12]].replace(t.q.parser,function(e,r,s){r&&(n[t.q.name][r]=s)}),n},parseOptions:{strictMode:!1,key:["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],q:{name:"queryKey",parser:/(?:^|&)([^&=]*)=?([^&]*)/g},parser:{strict:/^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,loose:/^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/}},getParam:function(e){for(var t={},r=e?e:window.location.search.substring(1),n=r.split("&"),s=0;s<n.length;s++){var i=n[s].split("=");if("undefined"==typeof t[i[0]])t[i[0]]=i[1];else if("string"==typeof t[i[0]]){var a=[t[i[0]],i[1]];t[i[0]]=a}else t[i[0]].push(i[1])}return t},getHost:function(e){return this.parse(e).host.replace("www.","")}}},{}],5:[function(e,t,r){"use strict";t.exports={escapeRegexp:function(e){return e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g,"\\$&")},setDate:function(e,t){var r=e.getTimezoneOffset()/60,n=e.getHours(),s=t||0===t?t:-r;e.setHours(n+r+s);var i=e.getFullYear(),a=this.setLeadingZeroToInt(e.getMonth()+1,2),o=this.setLeadingZeroToInt(e.getDate(),2),c=this.setLeadingZeroToInt(e.getHours(),2),u=this.setLeadingZeroToInt(e.getMinutes(),2),p=this.setLeadingZeroToInt(e.getSeconds(),2);return i+"-"+a+"-"+o+" "+c+":"+u+":"+p},setLeadingZeroToInt:function(e,t){for(var r=e+"";r.length<t;)r="0"+r;return r},randomInt:function(e,t){return Math.floor(Math.random()*(t-e+1))+e}}},{}],6:[function(e,t,r){"use strict";var n=e("./data"),s=e("./terms"),i=e("./helpers/cookies"),a=e("./helpers/uri"),o=e("./helpers/utils"),c=e("./params"),u=e("./migrations");t.exports=function(e){function t(){var e;if("undefined"!=typeof y.utm_source||"undefined"!=typeof y.utm_medium||"undefined"!=typeof y.utm_campaign||"undefined"!=typeof y.utm_content||"undefined"!=typeof y.utm_term||"undefined"!=typeof y.gclid||"undefined"!=typeof y.yclid||"undefined"!=typeof y[h.campaign_param])g(),e=r(s.traffic.utm);else if(f(s.traffic.organic))g(),e=r(s.traffic.organic);else if(!i.get(n.containers.session)&&f(s.traffic.referral))g(),e=r(s.traffic.referral);else{if(i.get(n.containers.first)||i.get(n.containers.current))return i.get(n.containers.current);g(),e=r(s.traffic.typein)}return e}function r(e){switch(e){case s.traffic.utm:b=s.traffic.utm,k="undefined"!=typeof y.utm_source?y.utm_source:"undefined"!=typeof y.gclid?"google":"undefined"!=typeof y.yclid?"yandex":s.none,w="undefined"!=typeof y.utm_medium?y.utm_medium:"undefined"!=typeof y.gclid?"cpc":"undefined"!=typeof y.yclid?"cpc":s.none,q="undefined"!=typeof y.utm_campaign?y.utm_campaign:"undefined"!=typeof y[h.campaign_param]?y[h.campaign_param]:"undefined"!=typeof y.gclid?"google_cpc":"undefined"!=typeof y.yclid?"yandex_cpc":s.none,I=y.utm_content||s.none,j=p()||s.none;break;case s.traffic.organic:b=s.traffic.organic,k=k||a.getHost(document.referrer),w=s.referer.organic,q=s.none,I=s.none,j=s.none;break;case s.traffic.referral:b=s.traffic.referral,k=k||a.getHost(document.referrer),w=w||s.referer.referral,q=s.none,I=a.parse(document.referrer).path,j=s.none;break;case s.traffic.typein:b=s.traffic.typein,k=h.typein_attributes.source,w=h.typein_attributes.medium,q=s.none,I=s.none,j=s.none;break;default:b=s.oops,k=s.oops,w=s.oops,q=s.oops,I=s.oops,j=s.oops}var t={type:b,source:k,medium:w,campaign:q,content:I,term:j};return n.pack.main(t)}function p(){var e=document.referrer;if(y.utm_term)return y.utm_term;if(!(e&&a.parse(e).host&&a.parse(e).host.match(/^(?:.*\.)?yandex\..{2,9}$/i)))return!1;try{return a.getParam(a.parse(document.referrer).query).text}catch(t){return!1}}function f(e){var t=document.referrer;switch(e){case s.traffic.organic:return!!t&&l(t)&&m(t);case s.traffic.referral:return!!t&&l(t)&&d(t);default:return!1}}function l(e){if(h.domain){if(_)return a.getHost(e)!==a.getHost(v);var t=new RegExp("^(?:.*\\.)?"+o.escapeRegexp(v)+"$","i");return!a.getHost(e).match(t)}return a.getHost(e)!==a.getHost(document.location.href)}function m(e){var t="yandex",r="text",n="google",s=new RegExp("^(?:.*\\.)?"+o.escapeRegexp(t)+"\\..{2,9}$"),i=new RegExp(".*"+o.escapeRegexp(r)+"=.*"),c=new RegExp("^(?:www\\.)?"+o.escapeRegexp(n)+"\\..{2,9}$");if(a.parse(e).query&&a.parse(e).host.match(s)&&a.parse(e).query.match(i))return k=t,!0;if(a.parse(e).host.match(c))return k=n,!0;if(!a.parse(e).query)return!1;for(var u=0;u<h.organics.length;u++){if(a.parse(e).host.match(new RegExp("^(?:.*\\.)?"+o.escapeRegexp(h.organics[u].host)+"$","i"))&&a.parse(e).query.match(new RegExp(".*"+o.escapeRegexp(h.organics[u].param)+"=.*","i")))return k=h.organics[u].display||h.organics[u].host,!0;if(u+1===h.organics.length)return!1}}function d(e){if(!(h.referrals.length>0))return k=a.getHost(e),!0;for(var t=0;t<h.referrals.length;t++){if(a.parse(e).host.match(new RegExp("^(?:.*\\.)?"+o.escapeRegexp(h.referrals[t].host)+"$","i")))return k=h.referrals[t].display||h.referrals[t].host,w=h.referrals[t].medium||s.referer.referral,!0;if(t+1===h.referrals.length)return k=a.getHost(e),!0}}function g(){i.set(n.containers.current_extra,n.pack.extra(h.timezone_offset),x,v,_),i.get(n.containers.first_extra)||i.set(n.containers.first_extra,n.pack.extra(h.timezone_offset),x,v,_)}var h=c.fetch(e),y=a.getParam(),v=h.domain.host,_=h.domain.isolate,x=h.lifetime;u.go(x,v,_);var b,k,w,q,I,j;return function(){i.set(n.containers.current,t(),x,v,_),i.get(n.containers.first)||i.set(n.containers.first,i.get(n.containers.current),x,v,_);var e,r;i.get(n.containers.udata)?(e=parseInt(i.parse(n.containers.udata)[i.unsbjs(n.containers.udata)][n.aliases.udata.visits])||1,e=i.get(n.containers.session)?e:e+1,r=n.pack.user(e,h.user_ip)):(e=1,r=n.pack.user(e,h.user_ip)),i.set(n.containers.udata,r,x,v,_);var s;i.get(n.containers.session)?(s=parseInt(i.parse(n.containers.session)[i.unsbjs(n.containers.session)][n.aliases.session.pages_seen])||1,s+=1):s=1,i.set(n.containers.session,n.pack.session(s),h.session_length,v,_),h.promocode&&!i.get(n.containers.promocode)&&i.set(n.containers.promocode,n.pack.promo(h.promocode),x,v,_)}(),i.parse(n.containers)}},{"./data":2,"./helpers/cookies":3,"./helpers/uri":4,"./helpers/utils":5,"./migrations":7,"./params":8,"./terms":9}],7:[function(e,t,r){"use strict";var n=e("./data"),s=e("./helpers/cookies");t.exports={go:function(e,t,r){var i,a=this.migrations,o={l:e,d:t,i:r};if(s.get(n.containers.first)||s.get(n.service.migrations)){if(!s.get(n.service.migrations))for(i=0;i<a.length;i++)a[i].go(a[i].id,o)}else{var c=[];for(i=0;i<a.length;i++)c.push(a[i].id);var u="";for(i=0;i<c.length;i++)u+=c[i]+"=1",i<c.length-1&&(u+=n.delimiter);s.set(n.service.migrations,u,o.l,o.d,o.i)}},migrations:[{id:"1418474375998",version:"1.0.0-beta",go:function(e,t){var r=e+"=1",i=e+"=0",a=function(e,t,r){return t||r?e:n.delimiter};try{var o=[];for(var c in n.containers)n.containers.hasOwnProperty(c)&&o.push(n.containers[c]);for(var u=0;u<o.length;u++)if(s.get(o[u])){var p=s.get(o[u]).replace(/(\|)?\|(\|)?/g,a);s.destroy(o[u],t.d,t.i),s.destroy(o[u],t.d,!t.i),s.set(o[u],p,t.l,t.d,t.i)}s.get(n.containers.session)&&s.set(n.containers.session,n.pack.session(0),t.l,t.d,t.i),s.set(n.service.migrations,r,t.l,t.d,t.i)}catch(f){s.set(n.service.migrations,i,t.l,t.d,t.i)}}}]}},{"./data":2,"./helpers/cookies":3}],8:[function(e,t,r){"use strict";var n=e("./terms"),s=e("./helpers/uri");t.exports={fetch:function(e){var t=e||{},r={};if(r.lifetime=this.validate.checkFloat(t.lifetime)||6,r.lifetime=parseInt(30*r.lifetime*24*60),r.session_length=this.validate.checkInt(t.session_length)||30,r.timezone_offset=this.validate.checkInt(t.timezone_offset),r.campaign_param=t.campaign_param||!1,r.user_ip=t.user_ip||n.none,t.promocode?(r.promocode={},r.promocode.min=parseInt(t.promocode.min)||1e5,r.promocode.max=parseInt(t.promocode.max)||999999):r.promocode=!1,t.typein_attributes&&t.typein_attributes.source&&t.typein_attributes.medium?(r.typein_attributes={},r.typein_attributes.source=t.typein_attributes.source,r.typein_attributes.medium=t.typein_attributes.medium):r.typein_attributes={source:"(direct)",medium:"(none)"},t.domain&&this.validate.isString(t.domain)?r.domain={host:t.domain,isolate:!1}:t.domain&&t.domain.host?r.domain=t.domain:r.domain={host:s.getHost(document.location.hostname),isolate:!1},r.referrals=[],t.referrals&&t.referrals.length>0)for(var i=0;i<t.referrals.length;i++)t.referrals[i].host&&r.referrals.push(t.referrals[i]);if(r.organics=[],t.organics&&t.organics.length>0)for(var a=0;a<t.organics.length;a++)t.organics[a].host&&t.organics[a].param&&r.organics.push(t.organics[a]);return r.organics.push({host:"bing.com",param:"q",display:"bing"}),r.organics.push({host:"yahoo.com",param:"p",display:"yahoo"}),r.organics.push({host:"about.com",param:"q",display:"about"}),r.organics.push({host:"aol.com",param:"q",display:"aol"}),r.organics.push({host:"ask.com",param:"q",display:"ask"}),r.organics.push({host:"globososo.com",param:"q",display:"globo"}),r.organics.push({host:"go.mail.ru",param:"q",display:"go.mail.ru"}),r.organics.push({host:"rambler.ru",param:"query",display:"rambler"}),r.organics.push({host:"tut.by",param:"query",display:"tut.by"}),r.referrals.push({host:"t.co",display:"twitter.com"}),r.referrals.push({host:"plus.url.google.com",display:"plus.google.com"}),r},validate:{checkFloat:function(e){return e&&this.isNumeric(parseFloat(e))?parseFloat(e):!1},checkInt:function(e){return e&&this.isNumeric(parseInt(e))?parseInt(e):!1},isNumeric:function(e){return!isNaN(e)},isString:function(e){return"[object String]"===Object.prototype.toString.call(e)}}}},{"./helpers/uri":4,"./terms":9}],9:[function(e,t,r){"use strict";t.exports={traffic:{utm:"utm",organic:"organic",referral:"referral",typein:"typein"},referer:{referral:"referral",organic:"organic",social:"social"},none:"(none)",oops:"(Houston, we have a problem)"}},{}]},{},[1])(1)});
;/*})'"*/
;/*})'"*/
sbjs.init({
  domain: 'iphonelife.com',
});


;/*})'"*/
;/*})'"*/
/*!
  hey, [be]Lazy.js - v1.8.2 - 2016.10.25
  A fast, small and dependency free lazy load script (https://github.com/dinbror/blazy)
  (c) Bjoern Klinggaard - @bklinggaard - http://dinbror.dk/blazy
*/
  (function(q,m){"function"===typeof define&&define.amd?define(m):"object"===typeof exports?module.exports=m():q.Blazy=m()})(this,function(){function q(b){var c=b._util;c.elements=E(b.options);c.count=c.elements.length;c.destroyed&&(c.destroyed=!1,b.options.container&&l(b.options.container,function(a){n(a,"scroll",c.validateT)}),n(window,"resize",c.saveViewportOffsetT),n(window,"resize",c.validateT),n(window,"scroll",c.validateT));m(b)}function m(b){for(var c=b._util,a=0;a<c.count;a++){var d=c.elements[a],e;a:{var g=d;e=b.options;var p=g.getBoundingClientRect();if(e.container&&y&&(g=g.closest(e.containerClass))){g=g.getBoundingClientRect();e=r(g,f)?r(p,{top:g.top-e.offset,right:g.right+e.offset,bottom:g.bottom+e.offset,left:g.left-e.offset}):!1;break a}e=r(p,f)}if(e||t(d,b.options.successClass))b.load(d),c.elements.splice(a,1),c.count--,a--}0===c.count&&b.destroy()}function r(b,c){return b.right>=c.left&&b.bottom>=c.top&&b.left<=c.right&&b.top<=c.bottom}function z(b,c,a){if(!t(b,a.successClass)&&(c||a.loadInvisible||0<b.offsetWidth&&0<b.offsetHeight))if(c=b.getAttribute(u)||b.getAttribute(a.src)){c=c.split(a.separator);var d=c[A&&1<c.length?1:0],e=b.getAttribute(a.srcset),g="img"===b.nodeName.toLowerCase(),p=(c=b.parentNode)&&"picture"===c.nodeName.toLowerCase();if(g||void 0===b.src){var h=new Image,w=function(){a.error&&a.error(b,"invalid");v(b,a.errorClass);k(h,"error",w);k(h,"load",f)},f=function(){g?p||B(b,d,e):b.style.backgroundImage='url("'+d+'")';x(b,a);k(h,"load",f);k(h,"error",w)};p&&(h=b,l(c.getElementsByTagName("source"),function(b){var c=a.srcset,e=b.getAttribute(c);e&&(b.setAttribute("srcset",e),b.removeAttribute(c))}));n(h,"error",w);n(h,"load",f);B(h,d,e)}else b.src=d,x(b,a)}else"video"===b.nodeName.toLowerCase()?(l(b.getElementsByTagName("source"),function(b){var c=a.src,e=b.getAttribute(c);e&&(b.setAttribute("src",e),b.removeAttribute(c))}),b.load(),x(b,a)):(a.error&&a.error(b,"missing"),v(b,a.errorClass))}function x(b,c){v(b,c.successClass);c.success&&c.success(b);b.removeAttribute(c.src);b.removeAttribute(c.srcset);l(c.breakpoints,function(a){b.removeAttribute(a.src)})}function B(b,c,a){a&&b.setAttribute("srcset",a);b.src=c}function t(b,c){return-1!==(" "+b.className+" ").indexOf(" "+c+" ")}function v(b,c){t(b,c)||(b.className+=" "+c)}function E(b){var c=[];b=b.root.querySelectorAll(b.selector);for(var a=b.length;a--;c.unshift(b[a]));return c}function C(b){f.bottom=(window.innerHeight||document.documentElement.clientHeight)+b;f.right=(window.innerWidth||document.documentElement.clientWidth)+b}function n(b,c,a){b.attachEvent?b.attachEvent&&b.attachEvent("on"+c,a):b.addEventListener(c,a,{capture:!1,passive:!0})}function k(b,c,a){b.detachEvent?b.detachEvent&&b.detachEvent("on"+c,a):b.removeEventListener(c,a,{capture:!1,passive:!0})}function l(b,c){if(b&&c)for(var a=b.length,d=0;d<a&&!1!==c(b[d],d);d++);}function D(b,c,a){var d=0;return function(){var e=+new Date;e-d<c||(d=e,b.apply(a,arguments))}}var u,f,A,y;return function(b){if(!document.querySelectorAll){var c=document.createStyleSheet();document.querySelectorAll=function(a,b,d,h,f){f=document.all;b=[];a=a.replace(/\[for\b/gi,"[htmlFor").split(",");for(d=a.length;d--;){c.addRule(a[d],"k:v");for(h=f.length;h--;)f[h].currentStyle.k&&b.push(f[h]);c.removeRule(0)}return b}}var a=this,d=a._util={};d.elements=[];d.destroyed=!0;a.options=b||{};a.options.error=a.options.error||!1;a.options.offset=a.options.offset||100;a.options.root=a.options.root||document;a.options.success=a.options.success||!1;a.options.selector=a.options.selector||".b-lazy";a.options.separator=a.options.separator||"|";a.options.containerClass=a.options.container;a.options.container=a.options.containerClass?document.querySelectorAll(a.options.containerClass):!1;a.options.errorClass=a.options.errorClass||"b-error";a.options.breakpoints=a.options.breakpoints||!1;a.options.loadInvisible=a.options.loadInvisible||!1;a.options.successClass=a.options.successClass||"b-loaded";a.options.validateDelay=a.options.validateDelay||25;a.options.saveViewportOffsetDelay=a.options.saveViewportOffsetDelay||50;a.options.srcset=a.options.srcset||"data-srcset";a.options.src=u=a.options.src||"data-src";y=Element.prototype.closest;A=1<window.devicePixelRatio;f={};f.top=0-a.options.offset;f.left=0-a.options.offset;a.revalidate=function(){q(a)};a.load=function(a,b){var c=this.options;void 0===a.length?z(a,b,c):l(a,function(a){z(a,b,c)})};a.destroy=function(){var a=this._util;this.options.container&&l(this.options.container,function(b){k(b,"scroll",a.validateT)});k(window,"scroll",a.validateT);k(window,"resize",a.validateT);k(window,"resize",a.saveViewportOffsetT);a.count=0;a.elements.length=0;a.destroyed=!0};d.validateT=D(function(){m(a)},a.options.validateDelay,a);d.saveViewportOffsetT=D(function(){C(a.options.offset)},a.options.saveViewportOffsetDelay,a);C(a.options.offset);l(a.options.breakpoints,function(a){if(a.width>=window.screen.width)return u=a.src,!1});setTimeout(function(){q(a)})}});
;/*})'"*/
;/*})'"*/
;(function() {
            // Initialize
            var bLazy = new Blazy();
})();

;/*})'"*/
;/*})'"*/
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

;/*})'"*/
;/*})'"*/
