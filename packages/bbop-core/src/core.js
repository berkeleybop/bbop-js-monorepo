/**
 * BBOP language extensions to JavaScript, complimenting Underscore.js.
 * Purpose: Helpful basic utilities and operations to fix common needs in JS.
 *
 * @module bbop-core
 */
import { default as us } from "underscore";

var each = us.each;

///
///
///

/**
 * Return the best guess (true/false) for whether or not a given
 * object is being used as a hash.
 *
 * @function
 * @name module:bbop-core#is_hash
 * @param {} in_thing - the thing in question
 * @returns {boolean} boolean
 */
function _is_hash(in_thing) {
  var retval = false;
  if (in_thing && us.isObject(in_thing) && !us.isArray(in_thing) && !us.isFunction(in_thing)) {
    retval = true;
  }
  return retval;
}

/**
 * Return the string best guess for what the input is, null if it
 * can't be identified. In addition to the _is_a property convention,
 * current core output strings are: 'null', 'array', 'boolean',
 * 'number', 'string', 'function', and 'object'.
 *
 * @function
 * @name module:bbop-core#what_is
 * @param {any} in_thing - the thing in question
 * @returns {string} string
 */
function _what_is(in_thing) {
  var retval = null;
  if (typeof in_thing != "undefined") {
    // If it's an object, try and guess the 'type', otherwise, let
    // typeof.
    if (in_thing == null) {
      retval = "null";
    } else if (typeof in_thing == "object") {
      // Look for the 'is_a' property that I should be using.
      if (typeof in_thing._is_a != "undefined") {
        retval = in_thing._is_a;
      } else {
        if (us.isArray(in_thing)) {
          retval = "array";
        } else {
          retval = "object";
        }
      }
    } else {
      retval = typeof in_thing;
    }
  }
  return retval;
}

/**
 * Dump an object to a string form as best as possible. More meant for
 * debugging. This is meant to be an Object walker. For a slightly
 * different take (Object identification), see <to_string>.
 *
 * @see module:bbop-core.to_string
 * @function
 * @name module:bbop-core#dump
 * @param {} in_thing - something
 * @returns {string} string
 */
function _dump(thing) {
  var retval = "";

  var what = _what_is(thing);
  if (what == null) {
    retval = "null";
  } else if (what == "null") {
    retval = "null";
  } else if (what == "string") {
    retval = '"' + thing + '"';
  } else if (what == "boolean") {
    if (thing) {
      retval = "true";
    } else {
      retval = "false";
    }
  } else if (what == "array") {
    var astack = [];
    each(thing, function (item) {
      astack.push(_dump(item));
    });
    retval = "[" + astack.join(", ") + "]";
  } else if (what == "object") {
    var hstack = [];
    each(thing, function (val, key) {
      hstack.push('"' + key + '": ' + _dump(val));
    });
    retval = "{" + hstack.join(", ") + "}";
  } else {
    retval = thing;
  }

  return retval;
}

/**
 * (Deep) clone an object down to its atoms.
 *
 * @function
 * @name module:bbop-core#clone
 * @param {any} thing - whatever
 * @returns {any} a new whatever
 */
function _clone(thing) {
  var clone = null;

  if (typeof thing === "undefined") {
    // Nothin' doin'.
    //print("looks undefined");
  } else if (typeof thing === "function") {
    // Dunno about this case...
    //print("looks like a function");
    clone = thing;
  } else if (typeof thing === "boolean" || typeof thing === "number" || typeof thing === "string") {
    // Atomic types can be returned as-is (i.e. assignment in
    // JS is the same as copy for atomic types).
    //print("cloning atom: " + thing);
    clone = thing;
  } else if (typeof thing === "object") {
    // Is it a null, hash, or an array?
    if (thing == null) {
      clone = null;
    } else if (Array.isArray(thing)) {
      // Looks like an array!
      //print("looks like an array");
      clone = [];
      for (var i = 0; i < thing.length; i++) {
        clone[i] = _clone(thing[i]);
      }
    } else {
      // Looks like a hash!
      //print("looks like a hash");
      clone = {};
      for (var h in thing) {
        clone[h] = _clone(thing[h]);
      }
    }
  } else {
    // Then I don't know what it is--might be platform dep.
    //print("no idea what it is");
  }
  return clone;
}

/**
 * Attempt to return a two part split on the first occurrence of a
 * character.
 *
 * Returns '' for parts not found.
 *
 * Unit tests make the edge cases clear.
 *
 * @function
 * @name module:bbop-core#first_split
 * @param {String} character - the character to split on
 * @param {String} string - the string to split
 * @returns {Array} list of first and second parts
 */
function _first_split(character, string) {
  var retlist = null;

  var eq_loc = string.indexOf(character);
  if (eq_loc == 0) {
    retlist = ["", string.substr(eq_loc + 1, string.length)];
  } else if (eq_loc > 0) {
    var before = string.substr(0, eq_loc);
    var after = string.substr(eq_loc + 1, string.length);
    retlist = [before, after];
  } else {
    retlist = ["", ""];
  }

  return retlist;
}

// Exportable body.
export default {
  clone: _clone,
  dump: _dump,
  first_split: _first_split,
  is_hash: _is_hash,
  what_is: _what_is,

  /**
   * Crop a string nicely.
   *
   * Returns: Nothing. Side-effects: throws an error if the namespace
   * defined by the strings is not currently found.
   *
   * @param {} str - the string to crop
   * @param {} lim - the final length to crop to (optional, defaults to 10)
   * @param {} suff - the string to add to the end (optional, defaults to '')
   * @returns {string} cropped string
   */
  crop: function (str, lim, suff) {
    var ret = str;

    var limit = 10;
    if (lim) {
      limit = lim;
    }

    var suffix = "";
    if (suff) {
      suffix = suff;
    }

    if (str.length > limit) {
      ret = str.substring(0, limit - suffix.length) + suffix;
    }
    return ret;
  },

  /**
   * Fold a pair of hashes together, using the first one as an initial
   * template--only the keys in the default hash will be defined in the
   * final hash--and the second hash getting precedence.
   *
   * The can be quite useful when defining functions--essentially
   * allowing a limited default value system for arguments.
   *
   * @see module:bbop-core.merge
   * @param {object} default_hash - Template hash.
   * @param {object} arg_hash - Argument hash to match.
   * @returns {object} a new hash
   */
  fold: function (default_hash, arg_hash) {
    if (!default_hash) {
      default_hash = {};
    }
    if (!arg_hash) {
      arg_hash = {};
    }

    var ret_hash = {};
    for (var key in default_hash) {
      if (!us.isUndefined(arg_hash[key])) {
        ret_hash[key] = arg_hash[key];
      } else {
        ret_hash[key] = default_hash[key];
      }
    }
    return ret_hash;
  },

  /**
   * Merge a pair of hashes together, the second hash getting
   * precedence. This is a superset of the keys both hashes.
   *
   * @see module:bbop-core.fold
   * @param {} older_hash - first pass
   * @param {} newer_hash - second pass
   * @returns {object} a new hash
   */
  merge: function (older_hash, newer_hash) {
    if (!older_hash) {
      older_hash = {};
    }
    if (!newer_hash) {
      newer_hash = {};
    }

    var ret_hash = {};
    function _add(val, key) {
      ret_hash[key] = val;
    }
    each(older_hash, _add);
    each(newer_hash, _add);
    return ret_hash;
  },

  /**
   * Get the hash keys from a hash/object, return as an array.
   *
   * @param {} arg_hash - the hash in question
   * @returns {Array} an array of keys
   */
  get_keys: function (arg_hash) {
    if (!arg_hash) {
      arg_hash = {};
    }
    var out_keys = [];
    for (var out_key in arg_hash) {
      if (arg_hash.hasOwnProperty(out_key)) {
        out_keys.push(out_key);
      }
    }

    return out_keys;
  },

  /**
   * Returns a hash form of the argument array/list. For example ['a',
   * 'b'] would become {'a': true, 'b': true} or [['a', '12'], ['b',
   * '21']] would become {'a': '12', 'b': '21'}. Using mixed sub-lists
   * is undefined.
   *
   * @param {Array} list - the list to convert
   * @returns {object} a hash
   */
  hashify: function (list) {
    var rethash = {};

    if (list && list[0]) {
      if (us.isArray(list[0])) {
        each(list, function (item) {
          var key = item[0];
          var val = item[1];
          if (!us.isUndefined(key)) {
            rethash[key] = val;
          }
        });
      } else {
        each(list, function (item) {
          rethash[item] = true;
        });
      }
    }

    return rethash;
  },

  // /**
  //  * Returns true if it things the two incoming arguments are value-wise
  //  * the same.
  //  *
  //  * Currently only usable for simple (atomic single layer) hashes,
  //  * atomic lists, boolean, null, number, and string values. Will return
  //  * false otherwise.
  //  *
  //  * @param {} thing1 - thing one
  //  * @param {} thing2 - thing two
  //  *
  //  * Returns: boolean
  //  */
  // is_same: function(thing1, thing2){

  // 	var retval = false;

  // 	// If is hash...steal the code from test.js.
  // 	if( _is_hash(thing1) && _is_hash(thing2) ){

  // 	    var same_p = true;

  // 	    // See if the all of the keys in hash1 are defined in hash2
  // 	    // and that they have the same ==.
  // 	    for( var k1 in thing1 ){
  // 		if( typeof thing2[k1] === 'undefined' ||
  // 		    thing1[k1] !== thing2[k1] ){
  // 			same_p = false;
  // 			break;
  // 		    }
  // 	    }

  // 	    // If there is still no problem...
  // 	    if( same_p ){

  // 		// Reverse of above.
  // 		for( var k2 in thing2 ){
  // 		    if( typeof thing1[k2] === 'undefined' ||
  // 			thing2[k2] !== thing1[k2] ){
  // 			    same_p = false;
  // 			    break;
  // 			}
  // 		}
  // 	    }

  // 	    retval = same_p;

  // 	}else if( bbop.core.is_array(thing1) && bbop.core.is_array(thing2) ){
  // 	    // If it's an array convert and pass it off to the hash function.
  // 	    retval = bbop.core.is_same(bbop.core.hashify(thing1),
  // 				       bbop.core.hashify(thing2));
  // 	}else{

  // 	    // So, we're hopefully dealing with an atomic type. If they
  // 	    // are the same, let's go ahead and try.
  // 	    var t1_is = _what_is(thing1);
  // 	    var t2_is = _what_is(thing2);
  // 	    if( t1_is == t2_is ){
  // 		if( t1_is == 'null' ||
  // 		    t1_is == 'boolean' ||
  // 		    t1_is == 'null' ||
  // 		    t1_is == 'number' ||
  // 		    t1_is == 'string' ){
  // 			if( thing1 == thing2 ){
  // 			    retval = true;
  // 			}
  // 		    }
  // 	    }
  // 	}

  // 	return retval;
  // },

  /**
   * Return the best guess (true/false) for whether or not a given
   * object is being used as an array.
   *
   * @param {} in_thing - the thing in question
   * @returns {boolean} boolean
   */
  is_array: function (in_thing) {
    var retval = false;
    if (in_thing && Array.isArray(in_thing)) {
      retval = true;
    }
    return retval;
  },

  /**
   * Return true/false on whether or not the object in question has any
   * items of interest (iterable?).
   *
   * @param {} in_thing - the thing in question
   * @returns {boolean} boolean
   */
  is_empty: function (in_thing) {
    var retval = false;
    if (us.isArray(in_thing)) {
      if (in_thing.length == 0) {
        retval = true;
      }
    } else if (_is_hash(in_thing)) {
      var in_hash_keys = us.keys(in_thing);
      if (in_hash_keys.length == 0) {
        retval = true;
      }
    } else {
      // TODO: don't know about this case yet...
      //throw new Error('unsupported type in is_empty');
      retval = false;
    }
    return retval;
  },

  /**
   * Return true/false on whether or not the passed object is defined.
   *
   * @param {} in_thing - the thing in question
   * @returns {boolean} boolean
   */
  is_defined: function (in_thing) {
    var retval = true;
    if (typeof in_thing === "undefined") {
      retval = false;
    }
    return retval;
  },

  /**
   * Take an array or hash and pare it down using a couple of functions
   * to what we want.
   *
   * Both parameters are optional in the sense that you can set them to
   * null and they will have no function; i.e. a null filter will let
   * everything through and a null sort will let things go in whatever
   * order.
   *
   * @param {Array|Object} in_thing - hash or array
   * @param {Function} filter_function - hash (function(key, val)) or array (function(item, i)); this function must return boolean true or false.
   * @param {Function} sort_function - function to apply to elements: function(a, b); this function must return an integer as the usual sort functions do.
   * @returns {Array} array
   */
  pare: function (in_thing, filter_function, sort_function) {
    var ret = [];

    // Probably an not array then.
    if (typeof in_thing === "undefined") {
      // this is a nothing, to nothing....
    } else if (typeof in_thing != "object") {
      throw new Error("Unsupported type in bbop.core.pare: " + typeof in_thing);
    } else if (us.isArray(in_thing)) {
      // An array; filter it if filter_function is defined.
      if (filter_function) {
        each(in_thing, function (item, index) {
          if (filter_function(item, index)) {
            // filter out item if true
          } else {
            ret.push(item);
          }
        });
      } else {
        each(in_thing, function (item) {
          ret.push(item);
        });
      }
    } else if (us.isFunction(in_thing)) {
      // Skip is function (which is also an object).
    } else if (us.isObject(in_thing)) {
      // Probably a hash; filter it if filter_function is defined.
      if (filter_function) {
        each(in_thing, function (val, key) {
          if (filter_function(key, val)) {
            // Remove matches to the filter.
          } else {
            ret.push(val);
          }
        });
      } else {
        each(in_thing, function (val) {
          ret.push(val);
        });
      }
    } else {
      // No idea what this is--skip.
    }

    // For both: sort if there is anything.
    if (ret.length > 0 && sort_function) {
      ret.sort(sort_function);
    }

    return ret;
  },

  /**
   * Essentially add standard 'to string' interface to the string class
   * and as a stringifier interface to other classes. More meant for
   * output--think REPL. Only atoms, arrays, and objects with a
   * to_string function are handled.
   *
   * @see module:bbop-core.dump
   * @param {any} in_thing - something
   * @returns {string} string
   */
  to_string: function (in_thing) {
    // First try interface, then the rest.
    if (
      in_thing &&
      typeof in_thing.to_string !== "undefined" &&
      typeof in_thing.to_string == "function"
    ) {
      return in_thing.to_string();
    } else {
      var what = _what_is(in_thing);
      if (what == "number") {
        return in_thing.toString();
      } else if (what == "string") {
        return in_thing;
      } else if (what == "array") {
        return _dump(in_thing);
        // }else if( what == 'object' ){
        //     return bbop.core.dump(in_thing);
        // }else{
        //     return '[unsupported]';
      } else {
        return in_thing;
      }
    }
  },

  /**
   * Check to see if all top-level objects in a namespace supply an
   * "interface".
   *
   * Mostly intended for use during unit testing.
   *
   * TODO: Unit test this to make sure it catches both prototype (okay I
   * think) and uninstantiated objects (harder/impossible?).
   *
   * @param {} iobj - the object/constructor in question
   * @param {} interface_list - the list of interfaces (as a strings) we're looking for
   * @returns {boolean} boolean
   */
  has_interface: function (iobj, interface_list) {
    var retval = true;
    each(interface_list, function (iface) {
      //print('|' + typeof(in_key) + ' || ' + typeof(in_val));
      //print('|' + in_key + ' || ' + in_val);
      if (typeof iobj[iface] == "undefined" && typeof iobj.prototype[iface] == "undefined") {
        retval = false;
        throw new Error(_what_is(iobj) + " breaks interface " + iface);
      }
    });
    return retval;
  },

  /**
   * Assemble an object into a GET-like query. You probably want to see
   * the tests to get an idea of what this is doing.
   *
   * The last argument of double hashes gets quoted (Solr-esque),
   * otherwise not. It will try and avoid adding additional sets of
   * quotes to strings.
   *
   * This does nothing to make the produced "URL" in any way safe.
   *
   * WARNING: Not a hugely clean function--there are a lot of special
   * cases and it could use a good (and safe) clean-up.
   *
   * @param {} qargs - hash/object
   * @returns {string} string
   */
  get_assemble: function (qargs) {
    var mbuff = [];
    for (var qname in qargs) {
      var qval = qargs[qname];

      // null is technically an object, but we don't want to render
      // it.
      if (qval != null) {
        if (typeof qval == "string" || typeof qval == "number") {
          // Is standard name/value pair.
          var nano_buffer = [];
          nano_buffer.push(qname);
          nano_buffer.push("=");
          nano_buffer.push(encodeURIComponent(qval));
          mbuff.push(nano_buffer.join(""));
        } else if (typeof qval == "object") {
          if (typeof qval.length != "undefined") {
            // Is array (probably).
            // Iterate through and double on.
            for (var qval_i = 0; qval_i < qval.length; qval_i++) {
              var nano_buff = [];
              nano_buff.push(qname);
              nano_buff.push("=");
              nano_buff.push(encodeURIComponent(qval[qval_i] || ""));
              mbuff.push(nano_buff.join(""));
            }
          } else {
            // // TODO: The "and" case is pretty much like
            // // the array, the "or" case needs to be
            // // handled carefully. In both cases, care will
            // // be needed to show which filters are marked.
            // Is object (probably).
            // Special "Solr-esque" handling.
            for (var sub_name in qval) {
              var sub_vals = qval[sub_name];

              // Since there might be an array down there,
              // ensure that there is an iterate over it.
              if (_what_is(sub_vals) != "array") {
                sub_vals = [sub_vals];
              }

              each(sub_vals, function (sub_val) {
                var nano_buff = [];
                nano_buff.push(qname);
                nano_buff.push("=");
                nano_buff.push(sub_name);
                nano_buff.push(":");
                if (typeof sub_val !== "undefined" && sub_val) {
                  // Do not double quote strings.
                  // Also, do not requote if we already
                  // have parens in place--that
                  // indicates a complicated
                  // expression. See the unit tests.
                  var val_is_a = _what_is(sub_val);
                  if (
                    val_is_a == "string" &&
                    sub_val.charAt(0) == '"' &&
                    sub_val.charAt(sub_val.length - 1) == '"'
                  ) {
                    nano_buff.push(encodeURIComponent(sub_val));
                  } else if (
                    val_is_a == "string" &&
                    sub_val.charAt(0) == "(" &&
                    sub_val.charAt(sub_val.length - 1) == ")"
                  ) {
                    nano_buff.push(encodeURIComponent(sub_val));
                  } else {
                    nano_buff.push(encodeURIComponent('"' + sub_val + '"'));
                  }
                } else {
                  nano_buff.push(encodeURIComponent('""'));
                }
                mbuff.push(nano_buff.join(""));
              });
            }
          }
        } else if (typeof qval == "undefined") {
          // This happens in some cases where a key is tried, but no
          // value is found--likely equivalent to q="", but we'll
          // let it drop.
          // var nano_buff = [];
          // nano_buff.push(qname);
          // nano_buff.push('=');
          // mbuff.push(nano_buff.join(''));
        } else {
          throw new Error("bbop.core.get_assemble: unknown type: " + typeof qval);
        }
      }
    }

    return mbuff.join("&");
  },

  /**
   * Random number generator of fixed length. Return a random number
   * string of length len.
   *
   * @param {} len - the number of random character to return.
   * @returns {string} string
   */
  randomness: function (len) {
    var random_base = [
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "0",
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "q",
      "r",
      "s",
      "t",
      "u",
      "v",
      "w",
      "x",
      "y",
      "z",
    ];
    var length = len || 10;
    var cache = new Array();
    for (var ii = 0; ii < length; ii++) {
      var rbase_index = Math.floor(Math.random() * random_base.length);
      cache.push(random_base[rbase_index]);
    }
    return cache.join("");
  },

  /**
   * Return the parameters part of a URL.
   *
   * Unit tests make the edge cases clear.
   *
   * @param {} url - url (or similar string)
   * @returns {Array} list of part lists
   */
  url_parameters: function (url) {
    var retlist = [];

    // Pull parameters.
    var tmp = url.split("?");
    var parms = [];
    if (!tmp[1]) {
      // catch bad url--nothing before '?'
      parms = tmp[0].split("&");
    } else {
      // normal structure
      parms = tmp[1].split("&");
    }

    // Decompose parameters.
    each(parms, function (p) {
      var c = _first_split("=", p);
      if (!c[0] && !c[1]) {
        retlist.push([p]);
      } else {
        retlist.push(c);
      }
    });

    return retlist;
  },

  /**
   * Convert a string into something consistent for urls (getting icons,
   * etc.). Return a munged/hashed-down version of the resource.
   * Assembles, converts spaces to underscores, and all lowercases.
   *
   * @param {} base - base url for the resource(s)
   * @param {} resource - the filename or whatever to be transformed
   * @param {} extension - *[optional]* the extension of the resource
   * @returns {string} string
   */
  resourcify: function (base, resource, extension) {
    var retval = base + "/" + resource;

    // Add the extension if it is there.
    if (extension) {
      retval += "." + extension;
    }

    // Spaces to underscores and all lowercase.
    //return retval.replace(/\ /g, "_", "g").toLowerCase();
    return retval.replace(/ /g, "_").toLowerCase();
  },

  /**
   * RFC 4122 v4 compliant UUID generator.
   * From: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
   *
   * @returns {string} string
   */
  uuid: function () {
    // Replace x (and y) in string.
    function replacer(c) {
      var r = (Math.random() * 16) | 0,
        v = c == "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    }
    var target_str = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
    return target_str.replace(/[xy]/g, replacer);
  },

  /**
   * A sort function to put numbers in ascending order.
   *
   * Useful as the argument to .sort().
   *
   * See: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/sort
   *
   * @param {number} a - the first number
   * @param {number} b - the second number
   * @returns {number} number of their relative worth
   */
  numeric_sort_ascending: function (a, b) {
    return a - b;
  },

  /**
   * A sort function to put numbers in descending order.
   *
   * Useful as the argument to .sort().
   *
   * See: https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Global_Objects/Array/sort
   *
   * @param {number} a - the first number
   * @param {number} b - the second number
   * @returns {number} number of their relative worth
   */
  numeric_sort_descending: function (a, b) {
    return b - a;
  },

  /**
   * Remove the quotes from a string.
   *
   * @param {string} str - the string to dequote
   * @returns {string} the dequoted string (or the original string)
   */
  dequote: function (str) {
    var retstr = str;

    if (!us.isUndefined(str) && str.length > 2) {
      var end = str.length - 1;
      if (str.charAt(0) == '"' && str.charAt(end) == '"') {
        retstr = str.substr(1, end - 1);
      }
    }

    return retstr;
  },

  /**
   * Make sure that a substring exists at the beginning or end (or both)
   * of a string.
   *
   * @param {} str - the string to ensure that has the property
   * @param {} add - the string to check for (and possibly add)
   * @param {} place - *[optional]* "front"|"back", place to ensure (defaults to both)
   * @returns {string} a new string with the property enforced
   */
  ensure: function (str, add, place) {
    //
    var do_front = false;
    var do_back = false;
    if (us.isUndefined(place)) {
      do_front = true;
      do_back = true;
    } else if (place == "front") {
      do_front = true;
    } else if (place == "back") {
      do_back = true;
    } else {
      // Don't know what it is, not doing anything.
    }

    //
    var strlen = str.length;
    var addlen = add.length;
    var front_substr = str.substr(0, addlen);
    var back_substr = str.substr(strlen - addlen, strlen - 1);

    //
    var front_add = "";
    if (do_front && front_substr != add) {
      front_add = add;
    }
    var back_add = "";
    if (do_back && back_substr != add) {
      back_add = add;
    }

    // console.log('do_front: ' + do_front);
    // console.log('do_back: ' + do_back);
    // console.log('str.length: ' + strlen);
    // console.log('add.length: ' + addlen);
    // console.log('front_substr: ' + front_substr);
    // console.log('back_substr: ' + back_substr);
    // console.log('front_add: ' + front_add);
    // console.log('back_add: ' + back_add);

    return front_add + str + back_add;
  },

  /**
   * Trim the leading and trailing whitespace from a string.
   * Named differently so as not to confuse with JS 1.8.1's trim().
   *
   * @param {string} str - the string to ensure that has the property
   * @returns {string} the trimmed string
   */
  chomp: function (str) {
    var retstr = "";

    retstr = str.replace(/^\s+/, "");
    retstr = retstr.replace(/\s+$/, "");

    return retstr;
  },

  /**
   * Break apart a string on certain delimiter.
   *
   * @param {} str - the string to ensure that has the property
   * @param {} delimiter - *[optional]* either a string or a simple regexp; defaults to ws
   *
   * @returns {Array} a list of separated substrings
   */
  splode: function (str, delimiter) {
    var retlist = null;

    if (!us.isUndefined(str)) {
      if (us.isUndefined(delimiter)) {
        delimiter = /\s+/;
      }

      retlist = str.split(delimiter);
    }

    return retlist;
  },

  // // Giving up on this for now: the general case seems too hard to work with
  // // in so many different, contradictory, and changing environments.
  // /**
  //  * Getting a cross-platform that can evaluate to the global namespace
  //  * seems a little bit problematic. This is an attempt to wrap that all
  //  * away.
  //  *
  //  * This is not an easy problem--just within browsers there are a lot
  //  * of issues:
  //  * http://perfectionkills.com/global-eval-what-are-the-options/ After
  //  * that, the server side stuff tries various ways to keep you from
  //  * affecting the global namespace in certain circumstances.
  //  *
  //  * @param {} to_eval - the string to evaluate
  //  *
  //  * Returns:
  //  *  A list with the following fields: retval, retval_str, okay_p, env_type.
  //  */
  // evaluate: function(to_eval){

  //     var retval = null;
  //     var retval_str = '';
  //     var okay_p = true;
  //     var env_type = 'server';

  //     // Try and detect our environment.
  //     try{
  // 	if( bbop.core.is_defined(window) &&
  // 	    bbop.core.is_defined(window.eval) &&
  // 	    bbop.core.what_is(window.eval) == 'function' ){
  // 		env_type = 'browser';
  // 	    }
  //     } catch (x) {
  // 	// Probably not a browser then, right? Hopefully all the
  // 	// servers that we'll run into are the same (TODO: check
  // 	// nodejs).
  //     }
  //     print('et: ' + env_type);

  //     // Now try for the execution.
  //     try{
  // 	// Try and generically evaluate.
  // 	if( env_type == 'browser' ){
  // 	    print('eval as if (browser)');
  // 	    retval = window.eval(to_eval);
  // 	}else{
  // 	    // TODO: Does this work?
  // 	    print('eval as else (server)');
  // 	    //retval = this.eval(to_eval);
  // 	    retval = bbop.core.global.eval(to_eval);
  // 	}
  //     }catch (x){
  // 	// Bad things happened.
  // 	print('fail on: (' + retval +'): ' + to_eval);
  // 	retval_str = '[n/a]';
  // 	okay_p = false;
  //     }

  //     // Make whatever the tmp_ret is prettier for the return string.
  //     if( bbop.core.is_defined(retval) ){
  // 	if( bbop.core.what_is(retval) == 'string' ){
  // 	    retval_str = '"' + retval + '"';
  // 	}else{
  // 	    retval_str = retval;
  // 	}
  //     }else{
  // 	// Return as-is.
  //     }

  //     return [retval, retval_str, okay_p, env_type];
  // };

  /**
   * What seems to be a typical idiom for subclassing in JavaScript.
   *
   * This attempt has been scraped together from bits here and there and
   * lucid explanations from Mozilla:
   *
   * https://developer.mozilla.org/en-US/docs/JavaScript/Introduction_to_Object-Oriented_JavaScript
   * https://developer.mozilla.org/en-US/docs/JavaScript/Guide/Details_of_the_Object_Model
   * https://developer.mozilla.org/en-US/docs/JavaScript/Guide/Inheritance_Revisited
   * https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Operators/new
   *
   * @param {} subclass - the subclass object
   * @param {} superclass - the superclass object
   */
  extend: function (subclass, baseclass) {
    // Create a temporary nothing so that we don't fiddle the
    // baseclass's(?) with what we do to subclass later on.
    function tmp_object() {}

    // This nothings prototype gets the base class's.
    tmp_object.prototype = baseclass.prototype;

    // We instantiate the tmp_object, whose prototype is the
    // baseclass's; we make subclass's prototype this object, giving
    // us something that is very much like baseclass.
    subclass.prototype = new tmp_object(); // same as: "new tmp_object();"

    // Now we go back and make the constructor of subclass actually
    // subclass again--we blew it away in the last step. Now we have a
    // subclass constructor with the protoype of baseclass.
    subclass.prototype.constructor = subclass;

    // // Create a property to allow access to the constructor of
    // // baseclass. This is useful when subclass needs access to
    // // baseclass's constructor for property setting.
    // subclass.base_constructor = baseclass;

    // // Create a property to
    // subclass.parent_class = baseclass.prototype;
  },

  /**
   * BBOP JS logger object. Using .kvetch(), you can automatically log a
   * message in almost any environment you find yourself in--browser,
   * server wherever. Also, if you have jQuery available and an element
   * with the id "bbop-logger-console-textarea",
   * "bbop-logger-console-text", or "bbop-logger-console-html", the
   * logger will append to that element (with a "\n" (autoscroll), "\n",
   * or "<br />" terminator respectively) instead.
   *
   * @constructor
   * @param {string} initial_context - (optional) initial context as string.
   */
  logger: function (initial_context) {
    /**
     * Different debugging available per object. Externally toggle
     * between true and false to switch on and off the logging.
     *
     * @variable {boolean}
     */
    this.DEBUG = false;

    var anchor = this;

    // Define an optional context to tag onto the front of messages.
    this._context = [];
    if (initial_context) {
      this._context = [initial_context];
    }

    /**
     * Define the ability to reset the contex.
     *
     * @param {string} new_initial_context - (optional) new context to start with
     */
    this.reset_context = function (new_initial_context) {
      if (new_initial_context) {
        this._context = [new_initial_context];
      } else {
        this._context = [];
      }
    };

    /**
     * Add an additional logging context to the stack.
     *
     * @param {string} new_context - New context to add to the context stack.
     */
    this.push_context = function (new_context) {
      this._context.push(new_context);
    };

    /**
     * Remove the last context if it's there.
     */
    this.pop_context = function () {
      var popped_context = null;
      if (this._context.length > 0) {
        popped_context = this._context.pop();
      }
      return popped_context;
    };

    // Generalizer console (or whatever) printing.
    this._console_sayer = function () {};

    if (
      typeof jQuery != "undefined" &&
      jQuery("#" + "bbop-logger-console-html") != "undefined" &&
      jQuery("#" + "bbop-logger-console-html").length
    ) {
      // Our own logging console takes precedence.
      this._console_sayer = function (msg) {
        var area = jQuery("#" + "bbop-logger-console-html");
        area.append(msg + "<br />");
        try {
          area.scrollTop(area[0].scrollHeight);
        } catch {
          // could scroll
        }
        //jQuery('#'+'bbop-logger-console-html').append(msg + "<br />");
      };
    } else if (typeof console != "undefined" && typeof console.log == "function") {
      // This may be okay for Chrome and a subset of various
      // console loggers. This should now include FF's Web
      // Console and NodeJS.  this._console_sayer =
      // function(msg){ console.log(msg + "\n"); }; These
      // usually seem to have "\n" incorporated now.
      this._console_sayer = function (msg) {
        console.log(msg);
      };
    } else if (typeof opera != "undefined" && typeof opera.postError == "function") {
      // If Opera is in there, probably Opera.
      this._console_sayer = function (msg) {
        opera.postError(msg + "\n");
      };
    } else if (typeof window != "undefined" && typeof window.dump == "function") {
      // From developer.mozilla.org: To see the dump output you
      // have to enable it by setting the preference
      // browser.dom.window.dump.enabled to true. You can set
      // the preference in about:config or in a user.js
      // file. Note: this preference is not listed in
      // about:config by default, you may need to create it
      // (right-click the content area -> New -> Boolean).
      this._console_sayer = function (msg) {
        dump(msg + "\n");
      };
    } else if (
      typeof window != "undefined" &&
      typeof window.console != "undefined" &&
      typeof window.console.log == "function"
    ) {
      // From developer.apple.com: Safari's "Debug" menu allows
      // you to turn on the logging of JavaScript errors. To
      // display the debug menu in Mac OS X, open a Terminal
      // window and type: "defaults write com.apple.Safari
      // IncludeDebugMenu 1" Need the wrapper function because
      // safari has personality problems.
      this._console_sayer = function (msg) {
        window.console.log(msg + "\n");
      };
    } else if (
      typeof build == "function" &&
      typeof getpda == "function" &&
      typeof pc2line == "function" &&
      typeof print == "function"
    ) {
      // This may detect SpiderMonkey on the comand line.
      this._console_sayer = function (msg) {
        print(msg);
      };
    } else if (
      typeof org != "undefined" &&
      typeof org.rhino != "undefined" &&
      typeof print == "function"
    ) {
      // This may detect Rhino on the comand line.
      this._console_sayer = function (msg) {
        print(msg);
      };
    }

    /**
     * Log a string to somewhere. Also return a string to (mostly for
     * the unit tests).
     *
     * @param {string} initial_context - (optional) initial context as string
     * @returns {string} string to print out to wherever we found
     */
    this.kvetch = function (string) {
      var ret_str = null;
      if (anchor.DEBUG == true) {
        // Make sure there is something there no matter what.
        if (typeof string == "undefined") {
          string = "";
        }

        // Redefined the string a little if we have contexts.
        if (anchor._context.length > 0) {
          var cstr = anchor._context.join(":");
          string = cstr + ": " + string;
        }

        // Actually log to the console.
        anchor._console_sayer(string);

        // Bind for output.
        ret_str = string;
      }
      return ret_str;
    };
  },
};
