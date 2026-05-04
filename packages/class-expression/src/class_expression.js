/**
 * Class expressions.
 *
 * A handling library for OWL-style class expressions in JavaScript.
 *
 * The idea here is to have a generic class expression class that can
 * be used at all levels of communication an display (instead of the
 * previous major/minor models).
 *
 * This is a full-bodied implementation of all the different aspects
 * that we need to capture for type class expressions: information
 * capture from JSON, on-the-fly creations, and display
 * properties. These used to be separate behaviors, but with the
 * client taking over more responsibility from Minerva, a more robust
 * and testable soluton was needed.
 *
 * Types can be: class ids and the expressions: SVF, union, and
 * intersection. Of the latter group, all are nestable.
 *
 * Categories is a graphical/UI distinction. They can be: instance_of,
 * <relation id>, union, and intersection.
 *
 * @module class-expression
 */

import us from "underscore";
import bbop from "bbop-core";

var each = us.each;
var keys = us.keys;
var what_is = bbop.what_is;

/**
 * Core constructor.
 *
 * The argument "in_type" may be:
 *  - a class id (string)
 *  - a JSON blob as described from Minerva
 *  - another <class_expression>
 *  - null (user will load or interactively create one)
 *
 * @constructor
 * @param {String|Object|class_expression|null} - the raw type description (see above)
 */
var class_expression = function (in_type) {
  this._is_a = "class_expression";

  var anchor = this;

  ///
  /// Initialize.
  ///

  // in_type is always a JSON object, trivial catch of attempt to
  // use just a string as a class identifier.
  if (in_type) {
    if (what_is(in_type) === "class_expression") {
      // Unfold and re-parse (takes some properties of new
      // host).
      in_type = in_type.structure();
    } else if (what_is(in_type) === "object") {
      // Fine as it is.
    } else if (what_is(in_type) === "string") {
      // Convert to a safe representation.
      in_type = {
        type: "class",
        id: in_type,
        label: in_type,
      };
    }
  }

  // Every single one is a precious snowflake (which is necessary
  // for managing some of the aspects of the UI for some use cases).
  this._id = bbop.uuid();

  // Derived property defaults.
  this._type = null;
  this._category = "unknown";
  this._class_id = null;
  this._class_label = null;
  this._property_id = null;
  this._property_label = null;
  // Recursive elements.
  this._frame = [];

  //
  this._raw_type = in_type;
  if (in_type) {
    anchor.parse(in_type);
  }
};

/**
 * Get the unique ID of this class expression.
 *
 * @returns {String} string
 */
class_expression.prototype.id = function () {
  return this._id;
};

/**
 * If the type has a recursive frame.
 *
 * @returns {Boolean} true or false
 */
class_expression.prototype.nested_p = function () {
  var retval = false;
  if (this._frame.length > 0) {
    retval = true;
  }
  return retval;
};

/**
 * A cheap way of identifying if two class_expressions are the same.
 * This essentially returns a string of the main attributes of a type.
 * It is meant to be semi-unique and collide with dupe inferences.
 *
 * BUG/WARNING: At this point, colliding signatures should mean a
 * dupe, but non-colliding signatures does *not* guarantee that they
 * are not dupes (think different intersection orderings).
 *
 * @returns {String} string
 */
class_expression.prototype.signature = function () {
  var anchor = this;

  var sig = [];

  // The easy ones.
  sig.push(anchor.category() || "");
  sig.push(anchor.type() || "");
  sig.push(anchor.class_id() || "");
  sig.push(anchor.property_id() || "");

  // And now recursively on frames.
  if (anchor.frame()) {
    each(anchor.frame(), function (f) {
      sig.push(f.signature() || "");
    });
  }

  return sig.join("_");
};

/**
 * Try to put an instance type into some kind of rendering category.
 *
 * @returns {String} string (default 'unknown')
 */
class_expression.prototype.category = function () {
  return this._category;
};

/**
 * The "type" of the type.
 *
 * @returns {String|null} string or null
 */
class_expression.prototype.type = function () {
  return this._type;
};

/**
 * The class expression when we are dealing with SVF.
 *
 * @returns {String|null} type or null
 */
class_expression.prototype.svf_class_expression = function () {
  var ret = null;
  if (this.type() === "svf") {
    ret = this._frame[0];
  }
  return ret;
};

/**
 * The class expression when we are dealing with a ComplementOf.
 *
 * @returns {String|null} type or null
 */
class_expression.prototype.complement_class_expression = function () {
  var ret = null;
  if (this.type() === "complement") {
    ret = this._frame[0];
  }
  return ret;
};

/**
 * If the type has a recursive frame, a list of the cls expr it
 * contains.
 *
 * @returns {Array} list of {class_expression}
 */
class_expression.prototype.frame = function () {
  return this._frame;
};

/**
 * The considered class id.
 *
 * @returns {String|null} string or null
 */
class_expression.prototype.class_id = function () {
  return this._class_id;
};

/**
 * The considered class label, defaults to ID if not found.
 *
 * @returns {String|null} string or null
 */
class_expression.prototype.class_label = function () {
  return this._class_label;
};

/**
 * The considered class property id.
 * Not defined for 'class' types.
 *
 * @returns {String|null} string or null
 */
class_expression.prototype.property_id = function () {
  return this._property_id;
};

/**
 * The considered class property label.
 * Not defined for 'class' types.
 *
 * @returns {String|null} string or null
 */
class_expression.prototype.property_label = function () {
  return this._property_label;
};

/**
 * Parse a JSON blob into the current instance, clobbering anything in
 * there, except id.
 *
 * @params {Object} in_type - conformant JSON object
 * @returns {this} self
 */
class_expression.prototype.parse = function (in_type) {
  var anchor = this;

  // Helper.
  function _decide_type(type) {
    var rettype = null;

    // Easiest case.
    var t = type["type"] || null;
    if (t === "class") {
      rettype = "class";
    } else if (t === "union") {
      rettype = "union";
    } else if (t === "intersection") {
      rettype = "intersection";
    } else if (t === "svf") {
      rettype = "svf";
    } else if (t === "complement") {
      rettype = "complement";
    } else {
      // No idea...
    }

    return rettype;
  }

  // Define the category, and build up an instant picture of what we
  // need to know about the property.
  var t = _decide_type(in_type);
  if (t === "class") {
    // Easiest to extract.
    this._type = t;
    this._category = "instance_of";
    this._class_id = in_type["id"];
    this._class_label = in_type["label"] || this._class_id;
    // No related properties.
  } else if (t === "union" || t === "intersection") {
    // conjunctions

    // These are simply recursive.
    this._type = t;
    this._category = t;

    // Load stuff into the frame.
    this._frame = [];
    var f_set = in_type["expressions"] || [];
    each(f_set, function (f_type) {
      anchor._frame.push(new class_expression(f_type));
    });
  } else if (t === "svf") {
    // SVF

    // We're then dealing with an SVF: a property plus a class
    // expression. We are expecting a "restriction", although we
    // don't really do anything with that information (maybe
    // later).
    this._type = t;
    // Extract the property information
    this._category = in_type["property"]["id"];
    this._property_id = in_type["property"]["id"];
    this._property_label = in_type["property"]["label"] || this._property_id;

    // Okay, let's recur down the class expression. It should just
    // be one, but we'll just reuse the frame. Access should be
    // though svf_class_expression().
    var f_type = in_type["filler"];
    this._frame = [new class_expression(f_type)];
  } else if (t === "complement") {
    // ComplementOf

    // We're then dealing with a ComplementOf. Not too bad.
    this._type = t;
    this._category = t;

    // Okay, let's recur down the class expression. It should just
    // be one, but we'll just reuse the frame. Access should be
    // though complement_class_expression().
    var f2_type = in_type["filler"];
    this._frame = [new class_expression(f2_type)];
  } else {
    // Should not be possible, so let's stop it here.
    //console.log('unknown type :', in_type);
    throw new Error("unknown type leaked in");
  }

  return anchor;
};

/**
 * Parse a JSON blob into the current instance, clobbering anything in
 * there, except id.
 *
 * @params {String} in_type - string
 * @returns {this} self
 */
class_expression.prototype.as_class = function (in_type) {
  if (in_type) {
    var ce = new class_expression(in_type);
    this.parse(ce.structure());
  }

  return this;
};

/**
 * Convert a null class_expression into an arbitrary SVF.
 *
 * @params {String} property_id - string
 * @params {String|class_expression} class_expr - ID string (e.g. GO:0022008) or <class_expression>
 * @returns {this} self
 */
class_expression.prototype.as_svf = function (property_id, class_expr) {
  // Cheap our way into this--can be almost anything.
  var cxpr = new class_expression(class_expr);

  // Our list of values must be defined if we go this way.
  var expression = {
    type: "svf",
    property: {
      type: "property",
      id: property_id,
    },
    filler: cxpr.structure(),
  };

  this.parse(expression);

  return this;
};

/**
 * Convert a null class_expression into an arbitrary complement.
 *
 * @params {String|class_expression} class_expr - ID string (e.g. GO:0022008) or <class_expression>
 * @returns {this} self
 */
class_expression.prototype.as_complement = function (class_expr) {
  // Cheap our way into this--can be almost anything.
  var cxpr = new class_expression(class_expr);

  // Our list of values must be defined if we go this way.
  var expression = {
    type: "complement",
    filler: cxpr.structure(),
  };

  this.parse(expression);

  return this;
};

/**
 * Convert a null class_expression into a set of class expressions.
 *
 * @params {String} set_type - 'intersection' || 'union'
 * @params {Array} set_list - list of ID strings of <class_expressions>
 * @returns {this} self
 */
class_expression.prototype.as_set = function (set_type, set_list) {
  // We do allow empties.
  if (!set_list) {
    set_list = [];
  }

  if (set_type === "union" || set_type === "intersection") {
    // Work into a viable argument.
    var set = [];
    each(set_list, function (item) {
      var cexpr = new class_expression(item);
      set.push(cexpr.structure());
    });

    // A little massaging is necessary to get it into the correct
    // format here.
    var fset = set_type;
    var parsable = {};
    parsable["type"] = fset;
    parsable["expressions"] = set;
    this.parse(parsable);
  }

  return this;
};

/**
 * Hm. Essentially dump out the information contained within into a
 * JSON object that is appropriate for consumption my Minerva
 * requests.
 *
 * @returns {Object} JSON object
 */
class_expression.prototype.structure = function () {
  var anchor = this;

  // We'll return this.
  var expression = {};

  // Extract type.
  var t = anchor.type();
  if (t === "class") {
    // trivial

    expression["type"] = "class";
    expression["id"] = anchor.class_id();
    // Only add label if it adds something?
    if (anchor.class_label() && anchor.class_id() !== anchor.class_label()) {
      expression["label"] = anchor.class_label();
    }
  } else if (t === "svf") {
    // SVF

    // Easy part of SVF.
    expression["type"] = "svf";
    expression["property"] = {
      type: "property",
      id: anchor.property_id(),
    };

    // Recur for someValuesFrom class expression.
    var svfce = anchor.svf_class_expression();
    var st = svfce.type();
    expression["filler"] = svfce.structure();
  } else if (t === "complement") {
    // ComplementOf

    expression["type"] = "complement";

    // Recur for someValuesFrom class expression.
    var cce = anchor.complement_class_expression();
    var ct = cce.type();
    expression["filler"] = cce.structure();
  } else if (t === "union" || t === "intersection") {
    // compositions

    // Recursively add all of the types in the frame.
    var ecache = [];
    var frame = anchor.frame();
    each(frame, function (ftype) {
      ecache.push(ftype.structure());
    });

    // Correct structure.
    expression["type"] = t;
    expression["expressions"] = ecache;
  } else {
    throw new Error("unknown type in request processing: " + t);
  }

  return expression;
};

/**
 * An attempt to have a simple attempt at a string representation for
 * a class expression.
 *
 * @param {String} front_str - (optional) start the output string with (default '')
 * @param {String} back_str - (optional) end the output string with (default '')
 * @returns {String} simple string rep
 */
class_expression.prototype.to_string = function (front_str, back_str) {
  var anchor = this;

  function _inner_lbl(ce) {
    var inner_lbl = "???";

    var cetype = ce.type();
    if (cetype === "class") {
      inner_lbl = ce.class_label();
    } else if (cetype === "union" || cetype === "intersection") {
      var cef = ce.frame();
      inner_lbl = cetype + "[" + cef.length + "]";
    } else if (cetype === "complement") {
      inner_lbl = "[NOT]";
    } else if (cetype === "svf") {
      inner_lbl = "[SVF]";
    } else {
      inner_lbl = "???";
    }

    return inner_lbl;
  }

  var ret = "[???]";

  var t = anchor.type();
  var f = anchor.frame();

  if (t === "class") {
    ret = anchor.class_label();
  } else if (t === "union" || t === "intersection") {
    ret = t + "[" + f.length + "]";
  } else if (t === "complement") {
    ret =
      "NOT" +
      //'[' + anchor.to_string(anchor.complement_class_expression()) + ']';
      "[" +
      _inner_lbl(anchor.complement_class_expression()) +
      "]";
  } else if (t === "svf") {
    // SVF a little harder.
    var ctype = anchor.property_label();

    // Probe it a bit.
    var ce = anchor.svf_class_expression();
    ret = "svf[" + ctype + "](" + _inner_lbl(ce) + ")";
  } else {
    ret = "???";
  }

  // A little special "hi" for inferred types, or something.
  if (front_str && typeof front_str === "string") {
    ret = front_str + ret;
  }
  if (back_str && typeof back_str === "string") {
    ret = ret + back_str;
  }

  return ret;
};

/**
 * An attempt to have a simple attempt at a string representation for
 * a class expression, with some extra information possibly not found
 * in the to_String() version (like maybe a visible ID, etc.).
 *
 * @param {String} front_str - (optional) start the output string with (default '')
 * @param {String} back_str - (optional) end the output string with (default '')
 * @returns {String} simple string rep
 */
class_expression.prototype.to_string_plus = function (front_str, back_str) {
  var anchor = this;

  // Class label is main, but prepend class ID if available and
  // different.
  function _class_labeler(ce) {
    var ret = ce.class_label();
    // Optional ID.
    var cid = ce.class_id();
    if (cid && cid !== ret) {
      ret = "[" + cid + "] " + ret;
    }
    return ret;
  }

  function _inner_lbl(ce) {
    var inner_lbl = "???";

    var cetype = ce.type();
    if (cetype === "class") {
      inner_lbl = _class_labeler(ce);
    } else if (cetype === "union" || cetype === "intersection") {
      var cef = ce.frame();
      inner_lbl = cetype + "[" + cef.length + "]";
    } else if (cetype === "complement") {
      inner_lbl = "[NOT]";
    } else if (cetype === "svf") {
      inner_lbl = "[SVF]";
    } else {
      inner_lbl = "???";
    }

    return inner_lbl;
  }

  var ret = "[???]";

  var t = anchor.type();
  var f = anchor.frame();

  if (t === "class") {
    ret = _class_labeler(anchor);
  } else if (t === "union" || t === "intersection") {
    ret = t + "[" + f.length + "]";
  } else if (t === "complement") {
    ret =
      "NOT" +
      //'[' + anchor.to_string(anchor.complement_class_expression()) + ']';
      "[" +
      _inner_lbl(anchor.complement_class_expression()) +
      "]";
  } else if (t === "svf") {
    // SVF a little harder.
    var ctype = anchor.property_label();

    // Probe it a bit.
    var ce = anchor.svf_class_expression();
    ret = "svf[" + ctype + "](" + _inner_lbl(ce) + ")";
  } else {
    ret = "???";
  }

  // A little special "hi" for inferred types, or something.
  if (front_str && typeof front_str === "string") {
    ret = front_str + ret;
  }
  if (back_str && typeof back_str === "string") {
    ret = ret + back_str;
  }

  return ret;
};

///
/// "Static" functions in package.
///

/**
 * "Static" function that creates an intersection from a list of
 * whatever.
 *
 * @param {Array} list - list of conformant whatever
 * @returns {class_expression} object
 */
class_expression.intersection = function (list) {
  var ce = new class_expression();
  ce.as_set("intersection", list);
  return ce;
};

/**
 * "Static" function that creates a union from a list of whatever.
 *
 * @param {Array} list - list of conformant whatever
 * @returns {class_expression} object
 */
class_expression.union = function (list) {
  var ce = new class_expression();
  ce.as_set("union", list);
  return ce;
};

/**
 * "Static" function that creates a SomeValueFrom from a property ID
 * and a class_expression (or string or whatever).
 *
 * @param {String} prop_id - ID
 * @param {class_expression|String} cls_expr - thing
 * @returns {class_expression} object
 */
class_expression.svf = function (prop_id, cls_expr) {
  var ce = new class_expression();
  ce.as_svf(prop_id, cls_expr);
  return ce;
};

/**
 * "Static" function that creates the complement of a given class
 * expression.
 *
 * @param {class_expression|String} cls_expr - thing
 * @returns {class_expression} object
 */
class_expression.complement = function (cls_expr) {
  var ce = new class_expression();
  ce.as_complement(cls_expr);
  return ce;
};

/**
 * "Static" function that creates a class_expression from a class ID.
 *
 * @param {String} id - string id
 * @returns {class_expression} object
 */
class_expression.cls = function (id) {
  var ce = new class_expression();
  ce.as_class(id);
  return ce;
};

// Exportable body.
export default class_expression;
