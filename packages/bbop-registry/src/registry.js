/**
 * Generic lightweight listener/callback registry system.
 *
 * @module bbop-registry
 */

import { default as us } from "underscore";
import bbop from "bbop-core";

var each = us.each;

/**
 * Constructor for BBOP registry. Takes a list of event categories as
 * strings.
 *
 * @constructor
 * @param {Array} evt_list - a list of strings that identify the events to be used
 * @returns {Object} bbop registry object
 */
var registry = function (evt_list) {
  this._is_a = "bbop-registry";

  var registry_anchor = this;

  // Handle the registration of call functions to get activated
  // after certain events.
  this.callback_registry = {};
  each(evt_list, function (item) {
    registry_anchor.callback_registry[item] = {};
  });

  /**
   * Add the specified function from the registry, with an optional
   * relative priority against other callback functions.
   *
   * The in_priority value is relative to others in the category,
   * with a higher priority...getting priority.
   *
   * See also: <apply>
   *
   * @param {String} category - one of the pre-defined categories
   * @param {Function} in_function - function
   * @param {Number} [in_priority] - the higher the faster
   * @param {String} [function_id] - a unique string to identify a function; generated if one is not given
   * @returns {String} the ID for the registered function in the given category
   */
  this.register = function (category, in_function, in_priority, function_id) {
    // Only these categories.
    if (typeof registry_anchor.callback_registry[category] === "undefined") {
      throw new Error("cannot register unknown category");
    }

    // The default priority is 0.
    var priority = 0;
    if (in_priority) {
      priority = in_priority;
    }

    // The default ID is generated, but take one if given.
    var fid = null;
    if (function_id) {
      fid = function_id;
    } else {
      fid = bbop.uuid();
    }

    // Final registration.
    registry_anchor.callback_registry[category][fid] = {
      runner: in_function,
      priority: priority,
    };

    return fid;
  };

  /**
   * Returns whether or not an id has already been registered to a
   * category. Will return null if the category does not exist.
   *
   * @param {String} category - one of the pre-defined categories
   * @param {String} function_id - a unique string to identify a function
   * @returns {Boolean|null} true, false, or null
   */
  this.is_registered = function (category, function_id) {
    var retval = null;

    var anc = registry_anchor.callback_registry;

    //
    if (typeof anc[category] !== "undefined") {
      retval = false;

      if (typeof anc[category][function_id] !== "undefined") {
        retval = true;
      }
    }

    return retval;
  };

  /**
   * Remove the specified function from the registry. Must specify a
   * legitimate category and the function id of the function in it.
   *
   * @param {String} category - string
   * @param {String} function_id - string
   * @returns {Boolean} boolean on whether something was unregistered
   */
  this.unregister = function (category, function_id) {
    var retval = false;
    if (
      registry_anchor.callback_registry[category] &&
      registry_anchor.callback_registry[category][function_id]
    ) {
      delete registry_anchor.callback_registry[category][function_id];
      retval = true;
    }
    return retval;
  };

  /**
   * Generic getter for callback functions, returns by priority.
   *
   * @param {String} category - string
   * @returns {Array} an ordered (by priority) list of function_id strings
   */
  this.get_callbacks = function (category) {
    var cb_id_list = us.keys(registry_anchor.callback_registry[category]);
    // Sort callback list according to priority.
    var ptype_registry_anchor = this;
    cb_id_list.sort(function (a, b) {
      var pkg_a = ptype_registry_anchor.callback_registry[category][a];
      var pkg_b = ptype_registry_anchor.callback_registry[category][b];
      return pkg_b["priority"] - pkg_a["priority"];
    });

    // Collect the actual stored functions by priority.
    var cb_fun_list = [];
    for (var cbi = 0; cbi < cb_id_list.length; cbi++) {
      var cb_id = cb_id_list[cbi];
      var to_run = registry_anchor.callback_registry[category][cb_id]["runner"];
      cb_fun_list.push(to_run);
      // ll('callback: ' + category + ', ' + cb_id + ', ' +
      //    this.callback_registry[category][cb_id]['priority']);
    }

    return cb_fun_list;
  };

  /**
   * Generic runner for prioritized callbacks with various arguments
   * and an optional change in context..
   *
   * @param {String} category - string
   * @param {Array} arg_list - a list of arguments to pass to the function in the category
   * @param {String} [context] - the context to apply the arguments in
   */
  this.apply_callbacks = function (category, arg_list, context) {
    // Run all against registered functions.
    var callbacks = registry_anchor.get_callbacks(category);
    for (var ci = 0; ci < callbacks.length; ci++) {
      var run_fun = callbacks[ci];
      //run_fun(arg_list);
      run_fun.apply(context, arg_list);
    }
  };
};

export default registry;
