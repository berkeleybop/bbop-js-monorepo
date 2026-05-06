/**
 * Purpose: Request construction library for interacting with Minerva.
 *
 * This module includes the following objects:
 *  - request_variable
 *  - request
 *  - request_set
 *
 * @module minerva-requests
 */

import us from "underscore";
import bbop from "bbop-core";
import class_expression from "class-expression";

var each = us.each;
var what_is = bbop.what_is;
var uuid = bbop.uuid;

/**
 * Constructor for a request variable, used to relate references during
 * a request.
 *
 * Internal usage variable for keeping track of implicit
 * assignToVariable on the client (see Minerva).
 *
 * @constructor
 * @param {String} [varvalue] - string representing a future variable value
 * @returns {request_variable} request variable object
 */
var request_variable = function (varvalue) {
  var anchor = this;
  anchor._is_a = "minerva-requests.request_variable";

  anchor._var = uuid(); // primo
  anchor._use_var_p = false;

  function _value(value) {
    if (value) {
      anchor._var = value;
      anchor._use_var_p = true;
    }
    return anchor._var;
  }
  // Do an initial revalue depending on the constructor's incoming
  // arguments.
  _value(varvalue);

  /**
   * The value of the variable to be used.
   *
   * @alias module:minerva-requests~request_variable#value
   * @function
   * @memberof module:minerva-requests~request_variable
   * @returns {String} string
   */
  anchor.value = _value;

  /**
   * Returns true or false on whether or not the user changed the
   * value of the setting.
   *
   * @alias module:minerva-requests~request_variable#set_p
   * @function
   * @memberof module:minerva-requests~request_variable
   * @returns {Boolean} boolean
   */
  anchor.set_p = function () {
    return anchor._use_var_p;
  };
};

/**
 * Constructor for a Minerva request item. See table for
 * operation/entity combinations:
 * https://github.com/berkeleybop/bbopx-js/wiki/MinervaRequestAPI .
 *
 * Handle requests to Minerva in a somewhat structured way.
 *
 * @constructor
 * @param {String} entity - string, see table
 * @param {String} operation - string, see table
 * @returns {request} request object
 */
var request = function (entity, operation) {
  var anchor = this;
  anchor._is_a = "minerva-requests.request";

  // Minerva entity to make a call against.
  anchor._entity = entity;

  // Minerva operation to perform on entity.
  anchor._operation = operation;

  // Almost all non-meta operations require a model id. However,
  // this is sometimes implied in the case of new model creation.
  anchor._model_id = null;

  // Tons of ops require individuals, and they need to be implicitly
  // passable.
  anchor._individual_id = new request_variable();

  // Hold most other additional arguments to the request.
  // TODO: Could use some checking here? Maybe per-entity?
  // Could possibly explore using swagger or json-schema?
  anchor._arguments = {};

  ///
  /// Internal helper functions.
  ///

  // Our list of values must be defined if we go this way.
  anchor._ensure_list = function (key) {
    if (!anchor._arguments[key]) {
      anchor._arguments[key] = [];
    }
  };

  // Add generic property (non-list).
  anchor._add = function (key, val) {
    anchor._arguments[key] = val;
    return anchor._arguments[key];
  };

  // Get generic property (non-list).
  anchor._get = function (key) {
    var ret = null;
    var t = anchor._arguments[key];
    if (t != null) {
      ret = t;
    }
    return ret;
  };

  // Getter/setter (non-list).
  anchor._get_set = function (key, variable) {
    if (variable) {
      anchor._add(key, variable);
    }
    return anchor._get(key);
  };

  ///
  /// Public API.
  ///

  /**
   * The specified entity string.
   *
   * @alias module:minerva-requests~request#entity
   * @function
   * @memberof module:minerva-requests~request
   * @returns {String|null} string or null
   */
  anchor.entity = function () {
    return anchor._entity;
  };

  /**
   * Add a "special" variable to the request. For a subset of
   * requests, this may be required. See table:
   * https://github.com/berkeleybop/bbopx-js/wiki/MinervaRequestAPI .
   *
   * @alias module:minerva-requests~request#special
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} name - string
   * @param {String} val - string
   * @returns {String} added value
   */
  anchor.special = function (name, val) {
    return anchor._get_set(name, val);
  };

  /**
   * Should only be used in the context of making a request set.
   *
   * Return a higher-level representation/"serialization" of the
   * complete object.
   *
   * @alias module:minerva-requests~request#objectify
   * @function
   * @memberof module:minerva-requests~request
   * @returns {Object} simple object
   */
  anchor.objectify = function () {
    // Things we will always return.
    var base = {
      entity: anchor._entity,
      operation: anchor._operation,
      arguments: anchor._arguments,
    };

    // If we're using an implicitly set individual id, make sure
    // that is added to the call.
    if (anchor._entity === "individual" && !anchor._individual_id.set_p()) {
      base["arguments"]["assign-to-variable"] = anchor._individual_id.value();
    }

    return base;
  };

  /**
   * Get/set the individual/instance in this request. If not set
   * explicitly, will fall back to a default value.
   *
   * @alias module:minerva-requests~request#individual
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} [ind_id] - individual id we're going to refer to
   * @param {Boolean} [force_id_p] - when an ID is supplied, in the case that the request is being used to create a *new individual* and the ID for it is already known, use ind_id as the IRI; defaults to not true
   * @returns {String} string
   */
  anchor.individual = function (ind_id, force_id_p) {
    if (ind_id) {
      if (force_id_p && force_id_p === true) {
        // known ind
        anchor._individual_id.value(ind_id);
        anchor._add("individual-iri", ind_id);
      } else {
        // reference
        anchor._individual_id.value(ind_id);
        anchor._add("individual", ind_id);
      }
    } else {
      // Fallback to using anonymous one (no change to default).
    }
    //anchor._add('individual', anchor._individual_id.value());
    return anchor._individual_id.value();
  };

  /**
   * Get/set the subject of this request.
   *
   * @alias module:minerva-requests~request#subject
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} [sub] - string
   * @returns {String|null} string or null
   */
  anchor.subject = function (sub) {
    return anchor._get_set("subject", sub);
  };

  /**
   * Get/set the object of this request. This will be used in
   * fact/edge requests, but not much else.
   *
   * @alias module:minerva-requests~request#object
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} [obj] - a string
   * @returns {String|null} string or null
   */
  anchor.object = function (obj) {
    return anchor._get_set("object", obj);
  };

  /**
   * Get/set the predicate of this request. This will be used in
   * fact/edge requests, but not much else.
   *
   * @alias module:minerva-requests~request#predicate
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} [pred] - a string
   * @returns {String|null} string or null
   */
  anchor.predicate = function (pred) {
    return anchor._get_set("predicate", pred);
  };

  /**
   * Get/set the topic model of this request.
   *
   * If a model is not set, like during requests in a set to a
   * not-yet-created model, Minerva will often add this itself if it
   * can after the fact.
   *
   * @alias module:minerva-requests~request#model
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} [model] - a string id
   * @returns {String|null} string or null
   */
  anchor.model = function (model) {
    return anchor._get_set("model-id", model);
  };

  /**
   * Add a fact to the request. The same as adding subject, object,
   * and predicate all separately.
   *
   * @alias module:minerva-requests~request#fact
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} sub - string
   * @param {String} obj - string
   * @param {String} pred - string
   * @returns {} n/a
   */
  anchor.fact = function (sub, obj, pred) {
    // Update the request's internal variables.
    anchor.subject(sub);
    anchor.object(obj);
    anchor.predicate(pred);
  };

  /**
   * Add an annotation pair (or series of pairs) to the request.
   * All annotations should be converted into strings for upstream consumption.
   * You may also add the optional value-type argument.
   *
   * @alias module:minerva-requests~request#add_annotation
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} key - string
   * @param {String} vals - string or list of strings
   * @param {String} [val_type] - value-type to use, as string; defaults to nothing (an implied string, i.e. "xsd:string"), although not explicitly sent
   * @returns {Number} number of annotations
   */
  anchor.add_annotation = function (key, vals, val_type) {
    // Convert val to a list if necessary.
    if (what_is(vals) === "string" || what_is(vals) === "number") {
      vals = [vals];
    }
    if (what_is(vals) !== "array") {
      throw new Error("unknown argument");
    }

    // Our list of values must be defined if we go this way.
    anchor._ensure_list("values");

    // Add all of the incoming values.
    each(vals, function (val) {
      // Numbers to strings.
      var final_val = val;
      if (what_is(val) === "number") {
        final_val = val.toString();
      }
      // Add on, slightly different if we have the optional
      // value-type on board since we will not send it in most
      // cases.
      if (val_type && what_is(val_type) === "string") {
        anchor._arguments["values"].push({
          key: key,
          value: final_val,
          "value-type": val_type,
        });
      } else {
        anchor._arguments["values"].push({
          key: key,
          value: final_val,
        });
      }
    });

    return anchor._arguments["values"].length;
  };

  /**
   * Return list of annotations in request.
   *
   * @alias module:minerva-requests~request#annotations
   * @function
   * @memberof module:minerva-requests~request
   * @returns {Array} (actual) list of request "values" pairs (or triples)
   */
  anchor.annotations = function () {
    return anchor._arguments["values"];
  };

  /**
   * General use for whatever.
   *
   * @alias module:minerva-requests~request#class_expression
   * @function
   * @memberof module:minerva-requests~request
   * @param {class_expression|String} class_expr - anything that can be taken by <class_expression> constructor
   * @param {String} property_id - string
   * @returns {Number} number of expressions
   */
  anchor.add_class_expression = function (class_expr) {
    // Our list of values must be defined if we go this way.
    anchor._ensure_list("expressions");

    var expr = new class_expression(class_expr);
    anchor._arguments["expressions"].push(expr.structure());

    return anchor._arguments["expressions"].length;
  };

  /**
   * Function: add_svf_expression
   *
   * Special use.
   * A short form for "addition" requests that can overload the
   * literal (on the server side) with Manchester syntax.
   *
   * @alias module:minerva-requests~request#add_svf_expression
   * @function
   * @memberof module:minerva-requests~request
   * @param {class_expression|String} class_expr - anything that can be taken by <class_expression> constructor
   * @param {String} property_id - string (id or...something more complicated?)
   * @returns {Number} number of expressions
   */
  anchor.add_svf_expression = function (class_expr, property_id) {
    // Our list of values must be defined if we go this way.
    anchor._ensure_list("expressions");

    var expr = new class_expression();
    expr.as_svf(class_expr, property_id);
    anchor._arguments["expressions"].push(expr.structure());

    return anchor._arguments["expressions"].length;
  };

  /**
   * Intersections and unions.
   *
   * @alias module:minerva-requests~request#add_set_class_expression
   * @function
   * @memberof module:minerva-requests~request
   * @param {String} type - 'intersection' or 'union'
   * @param {Array} class_expr_list - a list of anything that can be taken by <class_expression> constructor
   * @returns {Number} number of expressions
   */
  anchor.add_set_class_expression = function (type, class_expr_list) {
    // Our list of values must be defined if we go this way.
    anchor._ensure_list("expressions");

    var expr = new class_expression();
    expr.as_set(type, class_expr_list);
    anchor._arguments["expressions"].push(expr.structure());

    return anchor._arguments["expressions"].length;
  };

  /**
   * Return list of expressions in request.
   *
   * @alias module:minerva-requests~request#expressions
   * @function
   * @memberof module:minerva-requests~request
   * @returns {Array} (actual) list of request "expressions".
   */
  anchor.expressions = function () {
    return anchor._arguments["expressions"];
  };
};

/**
 * Constructor for a Minerva request item set.
 *
 * Handle sets of requests and serialize for Minerva call.
 *
 * Request sets are essentially serial request queues, that reference
 * each other using the request_variables contained in individual
 * requests.
 *
 * As the request_set operations almost always produce request_sets
 * (with sensible defaults and fail modes), they can easily be
 * chained together.
 *
 * If a model_id is given, it will be applied to any request that does
 * not have one.
 *
 * If reasoner_p is set to true, the request will make the request for
 * the use of the reasoner on the server; otherwise, no effect.
 *
 * @constructor
 * @param {String} user_token - string
 * @param {String} [model_id] - string
 * @param {Boolean} [reasoner_p] - bool
 * @param {Array} [group_ids] - (optional) list of string for group we want to apply to req
 * @returns {request_set} request set object
 */
var request_set = function (user_token, model_id, reasoner_p, group_ids) {
  var anchor = this;
  anchor._is_a = "minerva-requests.request_set";

  //
  anchor._user_token = user_token || null;
  anchor._model_id = model_id || null;
  anchor._requests = [];
  anchor._last_entity_id = null;

  // An optional argument, intended to filter and modify input from
  // RISCs (reduced instruction set clients). Intended to help
  // clarify how notcua should, change/interpret the input.
  // See the _external_user_id for more context.
  anchor._external_client_id = null;
  // An optional argument that is intended only to be used when
  // pre-creating argument packets for external resources--it will
  // never be read by Minerva, as Barista will only deal with
  // uris/user_ids taken from token->session information. However,
  // external resources may wish to know who is calling for their
  // round trips and kickouts.
  anchor._external_user_id = null;

  // Intentions, whether one wants their actions to be communicated
  // to the outside world ('action' vs 'query') are now silently
  // handled within the request_set framework. The default is the
  // weakest, unless (almost always) a creative operation is
  // attempted.
  anchor._intention = "query";

  // An externally facing id.
  anchor._external_model_id = null;

  // Whether or not to use the on-demand reasoner.
  anchor._use_reasoner = false;
  if (typeof reasoner_p === "boolean" && reasoner_p) {
    anchor._use_reasoner = true;
  }

  // What groups are tied to this request.
  anchor._use_groups = [];
  if (us.isArray(group_ids)) {
    anchor._use_groups = group_ids;
  }

  /**
   * Getter/setter for the request set token, to override, add,
   * or query after request set initialization.
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [tok] - string
   * @returns {String|null} string or null
   */
  anchor.token = function (tok) {
    if (us.isString(tok)) {
      anchor._user_token = tok;
    }

    return anchor._user_token;
  };

  /**
   * Getter/setter for the request set intention, to override, add,
   * or query after request set initialization.
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [intent] - string
   * @returns {String|null} string or null
   */
  anchor.intention = function (intent) {
    if (us.isString(intent) && (intent === "action" || intent === "query")) {
      anchor._intention = intent;
    }

    return anchor._intention;
  };

  /**
   * Getter/setter for the request set model id, to override, add,
   * or query after request set initialization.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316). Model IDs are typically
   * intended applied to the individual requests, rather than to the
   * packet.
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [mid] - string
   * @returns {String|null} string or null
   */
  anchor.external_model_id = function (rmid) {
    if (us.isString(rmid)) {
      anchor._external_model_id = rmid;
    }

    return anchor._external_model_id;
  };

  /**
   * Getter/setter for the request set client id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [cid] - string
   * @returns {String|null} string or null
   */
  anchor.external_client_id = function (cid) {
    if (us.isString(cid)) {
      anchor._external_client_id = cid;
    }

    return anchor._external_client_id;
  };

  /**
   * Getter/setter for the request set user id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_user_id = function (uid) {
    if (us.isString(uid)) {
      anchor._external_user_id = uid;
    }

    return anchor._external_user_id;
  };

  /**
   * Getter/setter for the request set individual id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_individual_id = function (uid) {
    if (us.isString(uid)) {
      anchor._external_individual_id = uid;
    }

    return anchor._external_individual_id;
  };

  /**
   * Getter/setter for the request set fact source id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_fact_source_id = function (uid) {
    if (us.isString(uid)) {
      anchor._external_fact_source_id = uid;
    }

    return anchor._external_fact_source_id;
  };

  /**
   * Getter/setter for the request set fact target id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_fact_target_id = function (uid) {
    if (us.isString(uid)) {
      anchor._external_fact_target_id = uid;
    }

    return anchor._external_fact_target_id;
  };

  /**
   * Getter/setter for the request set fact relation id, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_fact_relation_id = function (uid) {
    if (us.isString(uid)) {
      anchor._external_fact_relation_id = uid;
    }

    return anchor._external_fact_relation_id;
  };

  /**
   * Getter/setter for the request set return url, to override, add,
   * or query.
   *
   * Never for Noctua/Barista internal use--only intended for
   * creating packets for external use
   * (e.g. geneontology/noctua#316).
   *
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String|undef} [uid] - string
   * @returns {String|null} string or null
   */
  anchor.external_return_url = function (uid) {
    if (us.isString(uid)) {
      anchor._external_return_url = uid;
    }

    return anchor._external_return_url;
  };

  /**
   * Return the ID of the last individual identified in a call
   * (implicitly or explicitly).
   *
   * @see request_set#last_fact_triple
   * @alias module:minerva-requests~request_set#last_individual_id
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Number} [number_to_skip] - number of matches to skip (default: 0)
   * @returns {String|null} string or null
   */
  anchor.last_individual_id = function (number_to_skip) {
    var retval = null;

    // Get the last thing identifiable as an individual.
    // 'for' necessary for backwards breakable iteration.
    for (var ugh = anchor._requests.length; ugh > 0; ugh--) {
      var req = anchor._requests[ugh - 1];
      if (req.entity() === "individual") {
        if (number_to_skip > 0) {
          // knock off skipables
          number_to_skip--;
        } else {
          retval = req.individual();
          break;
        }
      }
    }

    return retval;
  };

  /**
   * In our model, facts are anonymous (do not have an ID) and need
   * to be referred to by their unique triple: subject id, object
   * id, and predicate (edge type) id.
   *
   * These methods return a list of the three string or null.
   *
   * @see request_set#last_individual_id
   * @alias module:minerva-requests~request_set#last_triple_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Number} [number_to_skip] - number of matches to skip (default: 0)
   * @returns {Array|null} list of three strings or null
   */
  anchor.last_fact_triple = function (number_to_skip) {
    var retval = null;

    // Get the last thing identifiable as an individual. 'for'
    // necessary for backwards breakable iteration.
    for (var ugh = anchor._requests.length; ugh > 0; ugh--) {
      var req = anchor._requests[ugh - 1];
      if (req.entity() === "edge") {
        if (number_to_skip > 0) {
          // knock off skipables
          number_to_skip--;
        } else {
          retval = [];
          retval.push(req.subject());
          retval.push(req.object());
          retval.push(req.predicate());
          break;
        }
      }
    }

    return retval;
  };

  /**
   * Add a request to the queue. This is the most "primitive" method
   * of adding things to the request queue and should only be used
   * when other methods (look at the API) are not available.
   *
   * @alias module:minerva-requests~request_set#add
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {request} req - <request>
   * @param {intention} [intention] - 'action' or 'query' ('action' default)
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add = function (req, intention) {
    // We always want the "strongest" intention for the batch.
    // If no explicit intention is mentioned, assume that this is
    // a custom op (outside of the API) and is there for an
    // 'action'.
    if (!intention) {
      anchor._intention = "action";
    } else if (intention === "action") {
      anchor._intention = intention;
    } else if (intention === "query") {
      // Skip as it is at least weaker than a possibly set
      // 'action'.
    }

    anchor._requests.push(req);
    return anchor;
  };

  /**
   * Requests necessary to add an instance of with type class to the
   * model.
   *
   * Expect: "success" and "merge".
   *
   * @alias module:minerva-requests~request_set#add_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {class_expression} [class_expr] - anything that can be taken by <class_expression> constructor; technically optional, but c'mon buddy
   * @param {String} [individual_id] - if none given, generate random one (preferred in most use cases); if one given, it's assumed to be a known "forced" one (see {individual})
   * @param {String} [model_id] - string
   * @returns {String} id of individual added, as string
   */
  anchor.add_individual = function (class_expr, individual_id, model_id) {
    var retval = null;

    var ind_req = new request("individual", "add");

    if (class_expr) {
      ind_req.add_class_expression(class_expr);
    }

    if (typeof individual_id === "string") {
      // optionally add known id
      //ind_req.special('individual-iri', individual_id);
      retval = ind_req.individual(individual_id, true);
    } else {
      // generate id (norm)
      retval = ind_req.individual();
    }

    if (model_id) {
      // optionally add
      ind_req.model(model_id);
    }

    anchor.add(ind_req, "action");

    //return anchor;
    return retval;
  };

  /**
   * Requests necessary to remove an individual.
   *
   * Expect: "success" and "rebuild".
   *
   * @alias module:minerva-requests~request_set#remove_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_individual = function (individual_id, model_id) {
    if (individual_id) {
      var ind_req = new request("individual", "remove");
      if (model_id) {
        ind_req.model(model_id);
      } // optionally add

      ind_req.individual(individual_id);

      anchor.add(ind_req, "action");
    }

    return anchor;
  };

  //  value - string
  //  model_id - (optional with fact and individual) string
  anchor._op_type_to_individual = function (op, class_expr, individual_id, model_id) {
    if (op && class_expr && individual_id) {
      if (op !== "add" && op !== "remove") {
        throw new Error("unknown type operation");
      } else {
        var type_req = new request("individual", op + "-type");
        type_req.individual(individual_id);

        if (model_id) {
          type_req.model(model_id);
        } // optionally add

        //
        type_req.add_class_expression(class_expr);

        anchor.add(type_req, "action");
      }
    }

    return anchor;
  };

  /**
   * Add the identified type to the individual. Multiple calls are
   * logically treated as an "intersection", but not processed and
   * displayed as such.
   *
   * @alias module:minerva-requests~request_set#add_type_to_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {class_expression} class_expr - anything that can be taken by <class_expression> constructor
   * @param {String} individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_type_to_individual = function (class_expr, individual_id, model_id) {
    return anchor._op_type_to_individual("add", class_expr, individual_id, model_id);
  };

  /**
   * Remove the identified type from the individual.
   *
   * @alias module:minerva-requests~request_set#remove_type_from_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {class_expression} class_expr - anything that can be taken by <class_expression> constructor
   * @param {String} individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_type_from_individual = function (class_expr, individual_id, model_id) {
    return anchor._op_type_to_individual("remove", class_expr, individual_id, model_id);
  };

  // Throw an error if no subject, object, predicate triple as
  // argument.
  anchor._ensure_fact = function (triple) {
    if (triple && triple[0] && triple[1] && triple[2]) {
      // Okay.
    } else {
      throw new Error("triple did not look like a proper fact");
    }
  };

  /**
   * Requests necessary to add an edge between two instances in a
   * model.
   *
   * Expect: "success" and "merge".
   *
   * @alias module:minerva-requests~request_set#add_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Array} triple - list of three strings: [SUBJECT_ID, OBJECT_ID, PREDICATE_ID]
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_fact = function (triple, model_id) {
    anchor._ensure_fact(triple);

    var edge_req = new request("edge", "add");
    if (model_id) {
      edge_req.model(model_id);
    } // optionally add

    edge_req.fact(triple[0], triple[1], triple[2]);

    anchor.add(edge_req, "action");

    return triple;
  };

  /**
   * Requests necessary to remove an edge between two instances in a
   * model.
   *
   * Expect: "success" and "rebuild".
   *
   * @alias module:minerva-requests~request_set#remove_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Array} triple - list of three strings: [SUBJECT_ID, OBJECT_ID, PREDICATE_ID]
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_fact = function (triple, model_id) {
    anchor._ensure_fact(triple);

    var edge_req = new request("edge", "remove");
    if (model_id) {
      edge_req.model(model_id);
    } // optionally add

    edge_req.fact(triple[0], triple[1], triple[2]);

    anchor.add(edge_req, "action");

    return anchor;
  };

  /**
   * Adds "anonymous" (current GO-style) evidence individual that is
   * referenced in the individual's or fact's annotations to the
   * batch.
   *
   * @alias module:minerva-requests~request_set#add_evidence
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} evidence_id - string
   * @param {String} source_ids - string or list of strings (i.e. PMIDs)
   * @param {String} with_strs - string or list of strings (i.e. "foo"); use null if evidence code does not support "with"
   * @param {String} target_identifier - string (individual_id) or list of 3 strings (fact)
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_evidence = function (evidence_id, source_ids, with_strs, target_identifier, model_id) {
    // Quick check.
    if (evidence_id && source_ids) {
      // Create floating evidence instance...
      var ev_ind_req = new request("individual", "add");
      if (model_id) {
        ev_ind_req.model(model_id);
      } // optional
      ev_ind_req.add_class_expression(evidence_id);
      anchor.add(ev_ind_req, "action");

      // Add each source as an annotation to the floating
      // evidence instance.
      var ev_ind_ann_req = new request("individual", "add-annotation");
      if (model_id) {
        ev_ind_ann_req.model(model_id);
      } // optional
      ev_ind_ann_req.individual(ev_ind_req.individual());
      ev_ind_ann_req.add_annotation("source", source_ids);
      // Optionally add the with fields, if defined.
      if (with_strs) {
        ev_ind_ann_req.add_annotation("with", with_strs);
      }
      anchor.add(ev_ind_ann_req, "action");

      // Switch the final tie-down object--either individual or
      // fact (triple).
      if (!target_identifier) {
        throw new Error("no target identified for evidence add");
      } else if (what_is(target_identifier) === "string") {
        // Tie the floating evidence to the individual
        // with an annotation to it.
        var ind_ann_req = new request("individual", "add-annotation");
        if (model_id) {
          ind_ann_req.model(model_id);
        } // optional
        ind_ann_req.individual(target_identifier);
        ind_ann_req.add_annotation("evidence", ev_ind_req.individual());
        anchor.add(ind_ann_req, "action");
      } else {
        // Bomb if not a legit triple.
        anchor._ensure_fact(target_identifier);

        // Tie the floating evidence to the edge with an
        // annotation to the edge.
        var ed_ann_req = new request("edge", "add-annotation");
        if (model_id) {
          ed_ann_req.model(model_id);
        } // optional
        var t = target_identifier;
        ed_ann_req.fact(t[0], t[1], t[2]);
        ed_ann_req.add_annotation("evidence", ev_ind_req.individual());
        anchor.add(ed_ann_req, "action");
      }
    }

    return anchor;
  };

  /**
   * Remove an evidence annotation from an individual or edge.
   *
   * Do not need to worry about the "floating" evidence instance
   * made by evidence creation--clean-up will be taken care of by
   * Minerva.
   *
   * @alias module:minerva-requests~request_set#remove_evidence
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} evidence_individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_evidence = function (evidence_individual_id, model_id) {
    // In our simplified world, evidence deletion just becomes a
    // specific case of individual deletion.
    if (evidence_individual_id) {
      anchor.remove_individual(evidence_individual_id, model_id);
    }

    return anchor;
  };

  /**
   * Adds "anonymous" evidence individual that is referenced in the
   * individual's annotations, as well as a fact of its own to the
   * batch.
   *
   * *[WARNING: Should only be used once, probably not at all!]*
   *
   * @alias module:minerva-requests~request_set#add_evidence_to_last_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} evidence_id - string
   * @param {String} source_ids - null, string, or list of strings (PMIDs, etc.)
   * @param {String} with_strs - string or list of strings (i.e. "foo"); use null if evidence code does not support "with"
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_evidence_to_last_individual = function (evidence_id, source_ids, with_strs, model_id) {
    var tmp_indv = anchor.last_individual_id();
    if (tmp_indv) {
      anchor.add_evidence(evidence_id, source_ids, with_strs, tmp_indv, model_id);
    }

    return anchor;
  };

  /**
   * Adds "anonymous" evidence individual that is referenced in the
   * fact's annotations, as well as a fact of its own to the batch.
   *
   * *[WARNING: Should only be used once, probably not at all!]*
   *
   * @alias module:minerva-requests~request_set#add_evidence_to_last_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} evidence_id - string
   * @param {String} source_ids - null, string, or list of strings (PMIDs, etc.)
   * @param {String} with_strs - string or list of strings (i.e. "foo"); use null if evidence code does not support "with"
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_evidence_to_last_fact = function (evidence_id, source_ids, with_strs, model_id) {
    var tmp_triple = anchor.last_fact_triple();
    if (tmp_triple) {
      anchor.add_evidence(evidence_id, source_ids, with_strs, tmp_triple, model_id);
    }

    return anchor;
  };

  // A helper function to sort out all of the different annotation
  // operations and targets in one function.
  //
  // Args:
  //  op - "add" | "remove"
  //  thing - "model" | "individual" | "edge"
  //  thing_identifier - ind: id; fact: triple; model: implied
  //  key - string
  //  value - string
  //  value_type - string, representing value-type, or nothing
  //  model_id - (optional with fact and individual) string
  anchor._op_annotation_to_target = function (
    op,
    target,
    target_identifier,
    key,
    value,
    value_type,
    model_id,
  ) {
    // First, decide the request.
    var req = null;
    if (op === "add" || op === "remove") {
      req = new request(target, op + "-annotation");
      if (model_id) {
        req.model(model_id);
      } // optional
    } else {
      throw new Error("unknown annotation operation");
    }

    // Add necessary arguments to identify the target.
    if (target === "model") {
      // Already done.
    } else if (target === "individual") {
      req.individual(target_identifier);
    } else if (target === "edge") {
      anchor._ensure_fact(target_identifier);
      req.fact(target_identifier[0], target_identifier[1], target_identifier[2]);
    } else {
      throw new Error("unknown annotation target");
    }

    // Add the annotation.
    if (key && value) {
      req.add_annotation(key, value, value_type);
      anchor.add(req, "action");
    }
  };

  /**
   * The purpose here is to update the set of annotations within an
   * entity with a new set of annotations. This process will happen
   * by key and key only (different value-types will be considered
   * the same).
   *
   * Since this takes the entire entity as an argument, it will
   * auto-detect what it is and add the correct ops.
   *
   * I suspect that this will be the Swiss army hammer as it can be
   * used to update, add, and remove annotations in the request set.
   *
   * We are going to ignore the possibility of races.
   *
   * @alias module:minerva-requests~request_set#update_annotations
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Object} entity - the enity from {module:bbop-graph-noctua} that you want to probe for annotation information to create the update
   * @param {String} key - the key to update
   * @param {String} values - string or list of strings
   * @param {String} [val_type] - value-type to use, as string; defaults to nothing (an implied string, i.e. "xsd:string"), although not explicitly sent
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.update_annotations = function (entity, key, values, value_type, model_id) {
    // Convert val to a list if necessary.
    if (what_is(values) === "string" || what_is(values) === "number") {
      values = [values];
    }
    if (what_is(values) !== "array") {
      throw new Error("unknown argument");
    }

    //
    var target = null; // string representing the entity internally.
    var target_identifier = null; // thing identifying the object
    if (what_is(entity) === "bbop-graph-noctua.graph") {
      target = "model";
      target_identifier = null;
    } else if (what_is(entity) === "bbop-graph-noctua.node") {
      target = "individual";
      target_identifier = entity.id();
    } else if (what_is(entity) === "bbop-graph-noctua.edge") {
      target = "edge";
      target_identifier = [entity.subject_id(), entity.object_id(), entity.predicate_id()];
    } else {
      throw new Error("update annotations internal error in entity type");
    }

    // Create requests to remove the current contents of the keyed
    // annotations in the entity.
    var anns = entity.get_annotations_by_key(key);
    each(anns, function (ann) {
      anchor._op_annotation_to_target(
        "remove",
        target,
        target_identifier,
        ann.key(),
        ann.value(),
        ann.value_type(),
        model_id,
      );
    });

    // Now add all of the pending annotations.
    each(values, function (val) {
      anchor._op_annotation_to_target(
        "add",
        target,
        target_identifier,
        key,
        val,
        value_type,
        model_id,
      );
    });

    return anchor;
  };

  /**
   * Adds unique key/value set to model.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#add_annotation_to_model
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_annotation_to_model = function (key, value, value_type, model_id) {
    anchor._op_annotation_to_target("add", "model", null, key, value, value_type, model_id);
    return anchor;
  };

  /**
   * Adds unique key/value set to model.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#remove_annotation_from_model
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_annotation_from_model = function (key, value, value_type, model_id) {
    anchor._op_annotation_to_target("remove", "model", null, key, value, value_type, model_id);
    return anchor;
  };

  /**
   * Adds unique key/value set to an individual.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#add_annotation_to_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_annotation_to_individual = function (key, value, value_type, individual_id, model_id) {
    anchor._op_annotation_to_target(
      "add",
      "individual",
      individual_id,
      key,
      value,
      value_type,
      model_id,
    );
    return anchor;
  };

  /**
   * Removes unique key/value set from an individual.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#remove_annotation_from_individual
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} individual_id - string
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_annotation_from_individual = function (
    key,
    value,
    value_type,
    individual_id,
    model_id,
  ) {
    anchor._op_annotation_to_target(
      "remove",
      "individual",
      individual_id,
      key,
      value,
      value_type,
      model_id,
    );
    return anchor;
  };

  /**
   * Adds unique key/value set to a fact.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#add_annotation_to_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} triple - list of three strings: [SUBJECT_ID, OBJECT_ID, PREDICATE_ID]
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_annotation_to_fact = function (key, value, value_type, triple, model_id) {
    anchor._ensure_fact(triple);
    anchor._op_annotation_to_target("add", "edge", triple, key, value, value_type, model_id);
    return anchor;
  };

  /**
   * Removes unique key/value set from a fact.
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#remove_annotation_from_fact
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} key - string
   * @param {String} value - string
   * @param {String|null} [value_type] - string
   * @param {String} triple - list of three strings: [SUBJECT_ID, OBJECT_ID, PREDICATE_ID]
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.remove_annotation_from_fact = function (key, value, value_type, triple, model_id) {
    anchor._ensure_fact(triple);
    anchor._op_annotation_to_target("remove", "edge", triple, key, value, value_type, model_id);
    return anchor;
  };

  /**
   * Undo the last batch of operations performed on the model.
   *
   * @alias module:minerva-requests~request_set#undo_last_model_batch
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} [model_id] - string
   * @returns {request_set}
   */
  anchor.undo_last_model_batch = function (model_id) {
    var mod_req = new request("model", "undo");
    if (model_id) {
      mod_req.model(model_id);
    } // optionally add

    anchor.add(mod_req, "action");

    return anchor;
  };

  /**
   * Redo the last batch of operations performed on the model.
   *
   * @alias module:minerva-requests~request_set#redo_last_model_batch
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.redo_last_model_batch = function (model_id) {
    var mod_req = new request("model", "redo");
    if (model_id) {
      mod_req.model(model_id);
    } // optionally add

    anchor.add(mod_req, "action");

    return anchor;
  };

  /**
   * Getter/setter to add (or not) a request to use an optional
   * reasoner.
   *
   * @alias module:minerva-requests~request_set#use_reasoner
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Boolean} [bool] - optional
   * @returns {Boolean} bool
   */
  anchor.use_reasoner = function (bool) {
    if (typeof bool === "boolean") {
      anchor._use_reasoner = bool;
    }

    return anchor._use_reasoner;
  };

  /**
   * Getter/setter to add (or not) a request to use an optional
   * group set. *null* and an empty array resets it to nothing.
   *
   * @alias module:minerva-requests~request_set#use_groups
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Array} [group_list] - optional
   * @returns {Boolean} bool
   */
  anchor.use_groups = function (group_list) {
    // Look at nullifications first.
    if (group_list === null) {
      anchor._use_groups = [];
    }
    if (us.isArray(group_list) && us.isEmpty(group_list)) {
      anchor._use_groups = [];
    }

    // See if we have a legit setter.
    if (us.isArray(group_list) && !us.isEmpty(group_list)) {
      anchor._use_groups = us.clone(group_list);
    }

    return us.clone(anchor._use_groups);
  };

  /**
   * Essentially, get the list of relations.
   *
   * @alias module:minerva-requests~request_set#get_meta
   * @function
   * @memberof module:minerva-requests~request_set
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.get_meta = function () {
    var req = new request("meta", "get");

    // Just personal question.
    anchor.add(req, "query");

    return anchor;
  };

  /**
   * The state of a model.
   *
   * This *[CANNOT]* be used with any other request.
   *
   * @alias module:minerva-requests~request_set#get_model
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} model_id - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.get_model = function (model_id) {
    var req = new request("model", "get");
    if (model_id) {
      req.model(model_id);
    }

    // Just personal question.
    anchor.add(req, "query");

    return anchor;
  };

  /**
   * Get the current undo/redo information for a model.
   *
   * This *[CANNOT]* be used with any other request.
   *
   * @alias module:minerva-requests~request_set#get_undo_redo
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.get_undo_redo = function (model_id) {
    var req = new request("model", "get-undo-redo");
    if (model_id) {
      req.model(model_id);
    }

    // Just personal question.
    anchor.add(req, "query");

    return anchor;
  };

  /**
   * Essentially a wrapper for the "generate" class of model
   * methods. The possible seeding arguments for the argument hash
   * are:
   *  class-id - *[optional]* string; an initial class to build around
   *  taxon-id - *[optional]* string; the background species
   *
   * @alias module:minerva-requests~request_set#add_model
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {Object} argument_hash - string (see above for properties)
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.add_model = function (argument_hash) {
    // Work out all incoming arguments to testable state.
    var cls_id = null;
    var tax_id = null;
    if (argument_hash) {
      if (argument_hash["class-id"]) {
        cls_id = argument_hash["class-id"];
      }
      if (argument_hash["taxon-id"]) {
        tax_id = argument_hash["taxon-id"];
      }
    }

    // Now that all arguments are defined, build up the request.
    var model_req = new request("model", "add");
    if (cls_id) {
      model_req.special("class-id", cls_id);
    }
    if (tax_id) {
      model_req.special("taxon-id", tax_id);
    }
    // Unlikely to have any listeners though...
    anchor.add(model_req, "action");

    return anchor;
  };

  /**
   * Store the model to the model store (file on disk as of this
   * writing, but may change soon).
   *
   * I'm not long sure what this exactly does...?
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#store_model
   * @function
   * @memberof module:minerva-requests~request_set
   * @param {String} [model_id] - string
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.store_model = function (model_id) {
    var store_req = new request("model", "store");
    if (model_id) {
      store_req.model(model_id);
    } // optionally add

    // No need to broadcast and disrupt to others on the model if
    // it's just this.
    anchor.add(store_req, "query");

    return anchor;
  };

  /**
   * Flush all models from the graph store to disk.
   *
   * This method was created to allow development in spite of a
   * copy-paste mistake in upstream code. This will eventually ve
   * deprecated in favor of "store_all".
   *
   * @deprecated
   * @alias module:minerva-requests~request_set#export_all
   * @function
   * @memberof module:minerva-requests~request_set
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.export_all = function () {
    var store_req = new request("meta", "export-all");

    // No need to broadcast and disrupt to others on the model if
    // it's just this.
    anchor.add(store_req, "query");

    return anchor;
  };

  /**
   * Flush all models from the graph store to disk.
   *
   * May not work until upstream problem referenced in "export_all"
   * is corrected.
   *
   * @alias module:minerva-requests~request_set#store_all
   * @function
   * @memberof module:minerva-requests~request_set
   * @returns {request_set} current request set, modified; suitable for chaining
   */
  anchor.store_all = function () {
    var store_req = new request("meta", "store-all");

    // No need to broadcast and disrupt to others on the model if
    // it's just this.
    anchor.add(store_req, "query");

    return anchor;
  };

  /**
   * Create the JSON object that will be passed to the Minerva
   * server.
   *
   * @alias module:minerva-requests~request_set#structure
   * @function
   * @memberof module:minerva-requests~request_set
   * @returns {Object} final object of all queued requests
   */
  anchor.structure = function () {
    // Ready the base return.
    var rset = {
      token: anchor._user_token,
      intention: anchor._intention,
    };

    // Only add use of the reasoner if requested.
    // Depending on it actually being a boolean here to make the string
    // request.
    if (anchor._use_reasoner && typeof anchor._use_reasoner === "boolean") {
      rset["use-reasoner"] = anchor._use_reasoner.toString();
    }

    // Only add groups if we tried to use them.
    var ugrps = anchor.use_groups();
    if (us.isArray(ugrps) && !us.isEmpty(ugrps)) {
      rset["provided-by"] = ugrps;
    }

    // For external arguments, only add iff we tried to use them.
    if (us.isString(anchor.external_model_id())) {
      rset["x-model-id"] = anchor.external_model_id();
    }
    if (us.isString(anchor.external_client_id())) {
      rset["x-client-id"] = anchor.external_client_id();
    }
    if (us.isString(anchor.external_user_id())) {
      rset["x-user-id"] = anchor.external_user_id();
    }
    if (us.isString(anchor.external_individual_id())) {
      rset["x-individual-id"] = anchor.external_individual_id();
    }
    if (us.isString(anchor.external_fact_source_id())) {
      rset["x-fact-source-id"] = anchor.external_fact_source_id();
    }
    if (us.isString(anchor.external_fact_target_id())) {
      rset["x-fact-target-id"] = anchor.external_fact_target_id();
    }
    if (us.isString(anchor.external_fact_relation_id())) {
      rset["x-fact-relation-id"] = anchor.external_fact_relation_id();
    }
    if (us.isString(anchor.external_return_url())) {
      rset["x-return-url"] = anchor.external_return_url();
    }

    // Add a JSON stringified request arguments.
    var reqs = [];
    each(anchor._requests, function (req) {
      // If possible, add model in cases where it was not supplied.
      if (!req.model() && anchor._model_id) {
        req.model(anchor._model_id);
      }
      reqs.push(req.objectify());
    });
    rset["requests"] = reqs;

    // However, if there are no requests (possibly in the case
    // that I'm trying to make a template), there can be no
    // intention.
    if (rset["requests"].length === 0) {
      delete rset["intention"];
    }

    return rset;
  };

  /**
   * Serialize a request set and the component requests.
   *
   * @alias module:minerva-requests~request_set#callable
   * @function
   * @memberof module:minerva-requests~request_set
   * @returns {Object} serialization of all queued requests
   */
  anchor.callable = function () {
    var rset = anchor.structure();
    var reqs = rset["requests"];

    var str = JSON.stringify(reqs);
    var enc = encodeURIComponent(str);
    rset["requests"] = enc;

    return rset;
  };
};

///
/// Exportable body.
///

export default {
  request_variable: request_variable,
  request: request,
  request_set: request_set,
};
