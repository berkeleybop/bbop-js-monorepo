/**
 * Purpose: Noctua editing operations over a bbop-graph base.
 *
 * The base pieces are just subclasses of their analogs in bbop-graph.
 *
 * Now, a discussion if the structure an terminology of the evidence
 * model.
 *
 * Definitions:
 *
 * - "model": the graph model as a whole
 * - "seed": an evidence instance that is referenced ; a seed may only belong to a single clique
 * - "sub_clique": the evidence subgraph pattern built off of a seed
 * - "clique" the complete evidence subgraph, obtained by walking all edges from any node in it (should be same no matter what node)
 * - "shared_struct": (currently) nodes of the clique that may be shared between different sub_cliques; for now, just pmid nodes
 *
 * Rules:
 *
 * A clique may only be removed from the graph, with its
 * constituent sub_cliques contained as referenced subgraphs,
 * when:
 * - all constituent sub_cliques have the "correct" structure
 * - all clique nodes are in at least one sub_clique
 * - sub_cliques only share structure in shared_struct nodes
 *
 * @see module:bbop-graph
 * @module bbop-graph-noctua
 */

import us from "underscore";
import bbop from "bbop-core";
import bbop_model from "bbop-graph";
import class_expression from "class-expression";

var each = us.each;
var keys = us.keys;

///
/// Debug helpers.
///

// Change these as necessary.
var debug_map = {
  // 'gomodel:5798651000000002/5798651000000003': 'set of upper jaw teeth',
  // 'gomodel:5798651000000002/5798651000000004': 'sharp',
  // 'gomodel:5798651000000002/5798651000000005': 'mouth',
  // 'gomodel:5798651000000002/5798651000000006': 'pointed',
  // 'gomodel:5798651000000002/5798651000000008': 'tongue',
  // 'gomodel:5798651000000002/5798651000000009': 'lip',
  // 'gomodel:5798651000000002/5798651000000010': 'tusk',
  // 'gomodel:5798651000000002/5798651000000033': 'taste bud'
};
var dd = function (id) {
  var ret = id;
  if (debug_map[id]) {
    ret = debug_map[id];
  }
  return ret;
};

function log() {
  console.log.apply(console, arguments);
}

///
/// Annotations.
///

/**
 * Edit annotations.
 * Everything can take annotations.
 *
 * This structure of the raw key-value set has been updated in the
 * wire protocol. It now looks like:
 *
 * : {"key": "contributor", "value": "GOC:kltm" }
 *
 * or:
 *
 * : {"key": "contributor", "value": "GOC:kltm", "value-type":"foo"}
 *
 * @constructor
 * @param {Object} [kv_set] - optional a set of keys and values; a simple object
 * @returns {this} new instance
 */
function annotation(kv_set) {
  this._id = bbop.uuid();

  this._properties = {};

  if (kv_set && bbop.what_is(kv_set) === "object") {
    // Attempt to convert
    if (kv_set["key"] && kv_set["value"]) {
      // var key = kv_set['key'];
      // var val = kv_set['value'];
      // var adj_set = {};
      // adj_set[key] = val;
      // Silently pass in value-type if there.
      this._properties = bbop.clone(kv_set);
    } else {
      // TODO: Replace this at some point with the logger.
      log("bad annotation k/v set: ", kv_set);
    }
  }
}

/**
 * The unique id of this annotation.
 *
 * @returns {String} string
 */
annotation.prototype.id = function () {
  return this._id;
};

/**
 * Add/modify a property by key and value (and maybe value_type).
 *
 * @param {String} key - string
 * @param {String} [value] - string
 * @param {String} [value_type] - string
 * @returns {String|null} returns property is key
 */
annotation.prototype.annotation = function (key, value, value_type) {
  var anchor = this;
  var ret = null;

  // Set if the key and value are there.
  if (key) {
    if (typeof value !== "undefined") {
      anchor._properties["key"] = key;
      anchor._properties["value"] = value;

      // Add or get rid of value type depending.
      if (typeof value_type === "undefined") {
        delete anchor._properties["value-type"];
      } else {
        anchor._properties["value-type"] = value_type;
      }
    }
  }
  ret = anchor._properties;

  return ret;
};

/**
 * Get/set annotation's key.
 *
 * @param {String} [key] - string
 * @returns {String|null} returns string of annotation
 */
annotation.prototype.key = function (key) {
  var anchor = this;
  if (key) {
    anchor._properties["key"] = key;
  }
  return anchor._properties["key"];
};

/**
 * Get/set annotation's value.
 *
 * @param {String} [value] - string
 * @returns {String|null} returns string of annotation
 */
annotation.prototype.value = function (value) {
  var anchor = this;
  if (value) {
    anchor._properties["value"] = value;
  }
  return anchor._properties["value"];
};

/**
 * Get/set annotation's value-type.
 *
 * @param {String} [value_type] - string
 * @returns {String|null} returns string of annotation
 */
annotation.prototype.value_type = function (value_type) {
  var anchor = this;
  if (value_type) {
    anchor._properties["value-type"] = value_type;
  }
  return anchor._properties["value-type"];
};

/**
 * Delete a property by key.
 *
 * @param {String} key - string
 * @returns {Boolean} true if not empty
 */
annotation.prototype.delete = function () {
  var anchor = this;
  var ret = false;

  if (!us.isEmpty(anchor._properties)) {
    anchor._properties = {}; // nuke
    ret = true;
  }

  return ret;
};

/**
 * Clone an annotation.
 *
 * @returns {annotation} a fresh annotation for no shared structure
 */
annotation.prototype.clone = function () {
  var anchor = this;

  // Copy most of the data structure.
  var a = {};
  if (anchor.key()) {
    a["key"] = anchor.key();
  }
  if (anchor.value()) {
    a["value"] = anchor.value();
  }
  if (anchor.value_type()) {
    a["value-type"] = anchor.value_type();
  }

  var new_ann = new annotation(a);

  // Copy ID as well.
  new_ann._id = anchor._id;

  return new_ann;
};

///
/// Generalized violations. Currently just around ShEx.
///

/**
 * Model violations.
 *
 * These are currently ShEx oriented, but will be expanded into OWL,
 * GO rules, etc. in the future.
 *
 * The current structure of the raw object looks like:
 *
 * : {"key": "contributor", "value": "GOC:kltm" }
 *
 * @constructor
 * @param {Object} [vobj] - optional TBD object structure for violations
 * @returns {this} new instance
 */
function violation(vobj) {
  this._id = bbop.uuid();
  this._node = null;
  this._explanations = [];

  if (us.isString(vobj["node"])) {
    this._node = bbop.clone(vobj["node"]);
  } else {
    log("bad violation node: ", this._id);
  }

  if (us.isArray(vobj["explanations"])) {
    this._explanations = bbop.clone(vobj["explanations"]);
  } else {
    log("bad violation explanations: ", this._id);
  }

  return this;
}

/**
 * The unique id of this violation.
 *
 * @returns {String} string
 */
violation.prototype.id = function () {
  return this._id;
};

/**
 * The unique id of this violation.
 *
 * @returns {String} string
 */
violation.prototype.node_id = function () {
  return this._node;
};

/**
 * The list of explanation objects for this violation.
 *
 * @returns {String} string
 */
violation.prototype.explanations = function () {
  return this._explanations;
};

/**
 * A clone of this violation object.
 *
 * @returns {violation} a fresh violation...
 */
violation.prototype.clone = function () {
  var anchor = this;

  var v = {};
  v["node"] = anchor.node_id();
  v["explanations"] = anchor.explanations();

  // Our constructor will use all new material, so no problem.
  var new_vio = new violation(v);
  return new_vio;
};

///
/// Generic internal annotation operations; dynamically attached to
/// graph, node, and edge.
///

/**
 * Get/set annotation list.
 *
 * @name annotations
 * @function
 * @param {Array} [in_anns] - list of annotations to clobber current list
 * @returns {Array} list of all annotations
 */
function _annotations(in_anns) {
  if (us.isArray(in_anns)) {
    this._annotations = in_anns;
  }
  return this._annotations;
}

/**
 * Add annotation.
 *
 * @name add_annotation
 * @function
 * @param {annotation} in_ann - annotation to add
 * @returns {Array} list of all annotations
 */
function _add_annotation(in_ann) {
  if (!us.isArray(in_ann)) {
    this._annotations.push(in_ann);
  }
  return this._annotations;
}

/**
 * Get a sublist of annotation using the filter function. The filter
 * function take a single annotation as an argument, and adds to the
 * return list if it evaluates to true.
 *
 * @name get_annotations_by_filter
 * @function
 * @param {Function} filter - function described above
 * @returns {Array} list of passing annotations
 */
function _get_annotations_by_filter(filter) {
  var anchor = this;
  var ret = [];
  each(anchor._annotations, function (ann) {
    var res = filter(ann);
    if (res && res === true) {
      ret.push(ann);
    }
  });
  return ret;
}

/**
 * Get sublist of annotations with a certain key.
 *
 * @name get_annotations_by_key
 * @function
 * @param {String} key - key to look for.
 * @returns {Array} list of list of annotations with that key
 */
function _get_annotations_by_key(key) {
  var anchor = this;

  var ret = [];
  each(anchor._annotations, function (ann) {
    if (ann.key() === key) {
      ret.push(ann);
    }
  });

  return ret;
}

/**
 * Get sublist of annotations with a certain ID.
 *
 * @name get_annotations_by_id
 * @function
 * @param {String} aid - annotation ID to look for
 * @returns {Array} list of list of annotations with that ID
 */
function _get_annotation_by_id(aid) {
  var anchor = this;
  var ret = null;
  each(anchor._annotations, function (ann) {
    if (ann.id() === aid) {
      ret = ann;
    }
  });
  return ret;
}

///
/// Generic internal evidence (reference individuals) operations;
/// dynamically attached to node and edge.
///

/**
 * Get/set referenced subgraph list.
 *
 * Copies in new data.
 *
 * @name referenced_subgraph
 * @function
 * @param {Array} [subgraphs] - list of {graph} to clobber current list
 * @returns {Array} list of all referenced subgraphs
 */
function _referenced_subgraphs(subgraphs) {
  if (us.isArray(subgraphs)) {
    // Not copies, so add by replacement.
    this._referenced_subgraphs = [];
    // // Convert type.
    each(subgraphs, function (g) {
      //g.type('referenced');
      this._referenced_subgraphs.push(g.clone());
    });
  }
  return this._referenced_subgraphs;
}

/**
 * Add referenced subgraph.
 *
 * @name add_referenced_subgraph
 * @function
 * @param {graph} subgraph - subgraph to add
 * @returns {Array} list of all subgraphs
 */
function _add_referenced_subgraph(subgraph) {
  if (!us.isArray(subgraph)) {
    //subgraph.type('referenced');
    this._referenced_subgraphs.push(subgraph);
  }
  return this._referenced_subgraphs;
}

/**
 * Get a sublist of referenced subgraphs using the filter
 * function. The filter function take a single subgraph as an
 * argument, and adds it to the return list if it evaluates to true.
 *
 * @name get_referenced_subgraphs_by_filter
 * @function
 * @param {Function} filter - function described above
 * @returns {Array} list of passing subgraphs
 */
function _get_referenced_subgraphs_by_filter(filter) {
  var anchor = this;

  var ret = [];
  each(anchor._referenced_subgraphs, function (g) {
    var res = filter(g);
    if (res && res === true) {
      ret.push(g);
    }
  });

  return ret;
}

/**
 * Get a referenced_subgraph with a certain ID.
 *
 * @name get_referenced_subgraph_by_id
 * @function
 * @param {String} iid - referenced_individual ID to look for
 * @returns {Object|null} referenced_subgraph with that ID
 */
function _get_referenced_subgraph_by_id(iid) {
  var anchor = this;

  var ret = null;
  each(anchor._referenced_subgraphs, function (g) {
    if (g.id() === iid) {
      ret = g;
    }
  });

  return ret;
}

/**
 * Returns a list with the following structure:
 *
 * : [ { id: <ID>,
 * :     class_expressions: [{class_expression}, ...],
 * :     anntations: [{annotation}, ...] },
 * :   ...
 * : ]
 *
 * Each top-level element in the list represents the core information
 * of a single referenced graph for a node or edge in this model.
 *
 * Keep in mind that this may be most useful in the GO Noctua use case
 * as reference subgraphs with singleton elements, where the class(es)
 * are evidence and the annotations keep things such as source
 * (e.g. PMID), etc.
 *
 * @name get_referenced_subgraph_profiles
 * @function
 * @param {Function} [extractor] extraction functions to use instead of default
 * @returns {Array} list of referenced_individual information
 */
function _get_referenced_subgraph_profiles(extractor) {
  var anchor = this;

  //
  function extractor_default(g) {
    var ret = null;

    // If singleton.
    if (g.all_nodes().length === 1) {
      var ind = g.all_nodes()[0];

      // Base.
      var prof = {
        id: null,
        class_expressions: [],
        annotations: [],
      };

      // Referenced instance ID.
      prof["id"] = ind.id();

      // Collect class expressions and annotations.
      each(ind.types(), function (ce) {
        prof["class_expressions"].push(ce);
      });
      each(ind.annotations(), function (ann) {
        prof["annotations"].push(ann);
      });

      //
      ret = prof;
    }

    return ret;
  }

  // If we are using the simple standard.
  if (typeof extractor !== "function") {
    extractor = extractor_default;
  }

  // Run the extractor over the referenced subraph in the calling
  // node.
  var ret = [];
  each(anchor.referenced_subgraphs(), function (g) {
    var extracted = extractor(g);
    if (extracted) {
      ret.push(extracted);
    }
  });

  return ret;
}

/**
 * Returns a list with the following structure:
 *
 * : [ { id: <ID>,
 * :     cls: <ID>,
 * :     source: <STRING>,
 * :     date: <STRING>,
 * :     etc
 * :   },
 * :   ...
 * : ]
 *
 * Each top-level element in the list represents the core information
 * in a simple (GO-style) element. This is essentially a distilled
 * version of get_referenced_individual_profiles for cases where that
 * is modelling simple piece of evidence (single non-nested class
 * expression and a set know list of annotations).
 *
 * @name get_basic_evidence
 * @function
 * @param {Array} annotation_ids - list of strings that identify the annotation keys that will be captured--
 * @returns {Array} list of referenced_individual simple evidence information.
 */
function _get_basic_evidence(annotation_ids) {
  var anchor = this;

  var ret = [];

  // Get hash of the annotation keys present.
  var test = us.object(
    us.map(annotation_ids, function (e) {
      return [e, true];
    }),
  );

  each(anchor.get_referenced_subgraph_profiles(), function (cmplx_prof) {
    //console.log(cmplx_prof);

    // Only add conformant referenced individuals.
    if (cmplx_prof.id && !us.isEmpty(cmplx_prof.class_expressions)) {
      // Base.
      //console.log(cmplx_prof.class_expressions);
      var basic_prof = {
        id: cmplx_prof.id,
        cls: cmplx_prof.class_expressions[0].to_string(),
      };

      // Match and clobber.
      each(cmplx_prof.annotations, function (ann) {
        //console.log(ann);
        if (test[ann.key()]) {
          basic_prof[ann.key()] = ann.value();
        }
      });

      //console.log(basic_prof);
      ret.push(basic_prof);
    }
  });

  return ret;
}

///
/// Next, get some subclasses working for the core triumvirate: graph,
/// node, edge. Start with graph.
///

var bbop_graph = bbop_model.graph;

/**
 * Sublcass of bbop-graph for use with Noctua ideas and concepts.
 *
 * Unlike the superclass, can take an id as an argument, or will
 * generate on on its own.
 *
 * @constructor
 * @see module:bbop-graph
 * @alias graph
 * @param {String} [new_id] - new id; otherwise new unique generated
 * @returns {this}
 */
function noctua_graph(new_id) {
  bbop_graph.call(this);
  this._is_a = "bbop-graph-noctua.graph";

  // Deal with id or generate a new one.
  if (typeof new_id !== "undefined") {
    this.id(new_id);
  }

  // The old edit core.
  this.core = {
    edges: {}, // map of id to edit_edge - edges not completely anonymous
    node_order: [], // initial table order on redraws
    node2elt: {}, // map of id to physical object id
    elt2node: {}, // map of physical object id to id
    // Remeber that edge ids and elts ids are the same, so no map
    // is needed.
    edge2connector: {}, // map of edge id to virtual connector id
    connector2edge: {}, // map of virtual connector id to edge id
  };

  this._annotations = [];
  //this._referenced_subgraphs = []; // not for graph yet, or maybe ever

  // Some things that come up in live noctua environments. These are
  // graph properties that may or may not be there. If unknown,
  // null; if positively true (bad), true; may be false otherwise.
  this._inconsistent_p = null;
  this._modified_p = null;

  // New section as we work out how violations operate.
  this._violations = [];
  this._valid_p = true;
  this._valid_owl_p = true;
  this._valid_shex_p = true;
}
bbop.extend(noctua_graph, bbop_graph);

/**
 * Create an edge for use in internal operations.
 *
 * @param {string} subject - node id string or node
 * @param {string} object - node id string or node
 * @param {string} [predicate] - a user-friendly description of the node
 * @returns {edge} bbop model edge
 */
noctua_graph.prototype.create_edge = function (subject, object, predicate) {
  return new noctua_edge(subject, object, predicate);
};

/**
 * Create a node for use in internal operations.
 *
 * @param {string} id - a unique id for the node
 * @param {string} [label] - a user-friendly description of the node
 * @param {Array} [types] - list of types to pre-load
 * @param {Array} [inferred_types] - list of inferred types to pre-load
 * @returns {node} new bbop model node
 */
noctua_graph.prototype.create_node = function (
  id,
  label,
  types,
  root_types,
  inferred_types,
  inferred_types_with_all,
) {
  return new noctua_node(id, label, types, root_types, inferred_types, inferred_types_with_all);
};

/**
 * Create a clone of the graph.
 *
 * Naturally, ID is copied.
 *
 * @returns {graph} bbop model graph
 */
noctua_graph.prototype.clone = function () {
  var anchor = this;

  var new_graph = anchor.create_graph();

  // Collect the nodes and edges.
  each(anchor.all_nodes(), function (node) {
    new_graph.add_node(node.clone());
  });
  each(anchor.all_edges(), function (edge) {
    new_graph.add_edge(edge.clone());
  });

  // Collect other information.
  new_graph.default_predicate = anchor.default_predicate;
  new_graph._id = anchor._id;

  // Copy new things: annotations.
  each(anchor._annotations, function (annotation) {
    new_graph._annotations.push(annotation.clone());
  });

  // Copy other properties over.
  new_graph._inconsistent_p = anchor._inconsistent_p;
  new_graph._modified_p = anchor._modified_p;

  // Copy violation information over.
  each(anchor._violations, function (v) {
    new_graph._violations.push(v.clone());
  });
  new_graph._valid_p = anchor._valid_p;
  new_graph._valid_owl_p = anchor._valid_owl_p;
  new_graph._valid_shex_p = anchor._valid_shex_p;

  return new_graph;
};

/**
 * Create a graph for use in internal operations.
 *
 * @returns {graph} bbop model graph
 */
noctua_graph.prototype.create_graph = function () {
  return new noctua_graph();
};

/**
 * Add an ID to the graph.
 *
 * Use .id() instead.
 *
 * @deprecated
 * @see module:bbop-graph#id
 * @param {String} id - string
 * @returns {String} string
 */
noctua_graph.prototype.add_id = function (id) {
  return this.id(id);
};

/**
 * Get the ID from the graph.
 *
 * Use .id() instead.
 *
 * @deprecated
 * @see module:bbop-graph#id
 * @returns {String} string
 */
noctua_graph.prototype.get_id = function () {
  return this.id();
};

/**
 * Returns true if the model had the "inconsistent-p" property when
 * built.
 *
 * @returns {Boolean|null} inconsistent or not; null if unknown
 */
noctua_graph.prototype.inconsistent_p = function () {
  return this._inconsistent_p;
};

/**
 * Returns true if the model had the "modified-p" property when
 * built.
 *
 * @returns {Boolean|null} inconsistent or not; null if unknown
 */
noctua_graph.prototype.modified_p = function () {
  return this._modified_p;
};

/**
 * Returns boolean on whether the returned model is /completely/
 * valid; true if there is no logic to probe (this is a temporary
 * measure until reasoner is "always on").
 *
 * @returns {Boolean} p - bool
 */
noctua_graph.prototype.valid_p = function () {
  return this._valid_p;
};

/**
 * Returns boolean on whether the returned model is valid according to
 * the owl reasoner; true if there is no logic to probe (this is a temporary
 * measure until reasoner is "always on").
 *
 * @returns {Boolean} p - bool
 */
noctua_graph.prototype.valid_owl_p = function () {
  return this._valid_owl_p;
};

/**
 * Returns boolean on whether the returned model is valid according to
 * ShEx shapes in Minerva; true if there is no logic to probe (this is
 * a temporary measure until reasoner is "always on").
 *
 * @returns {Boolean} p - bool
 */
noctua_graph.prototype.valid_shex_p = function () {
  return this._valid_shex_p;
};

/**
 * Returns an array of objects that describe the ShEx violations
 * found in a model.
 *
 * @returns {Array} violations or an empty list if none
 */
noctua_graph.prototype.violations = function () {
  return this._violations;
};

/**
 * Return an edge by is ID.
 *
 * @param {String} node_id - the ID of the {edge}
 * @returns {Array|Null} - Returns a list of 'violation' found in the graph for a given id.
 */
noctua_graph.prototype.get_violations_by_id = function (node_id) {
  var ret = [];

  // TODO: needs to be optimized once we figure out how we handle
  // shex + owl + whatever as general objects in here.
  each(this.violations(), function (v) {
    if (v.node_id() === node_id) {
      ret.push(v.clone());
    }
  });

  return ret;
};

/**
 * Get the ID from the graph.
 *
 * @param {node} enode - noctua node
 * @returns {Boolean} true on new node
 */
noctua_graph.prototype.add_node = function (enode) {
  // Super call: add it to the general graph.
  bbop_graph.prototype.add_node.call(this, enode);

  var ret = false;

  // Add/update node.
  var enid = enode.id();
  //this.core['nodes'][enid] = enode; // add to nodes

  // Only create a new elt ID and order if one isn't already in
  // there (or reuse things to keep GUI working smoothly).
  var elt_id = this.core["node2elt"][enid];
  if (!elt_id) {
    // first time
    this.core["node_order"].unshift(enid); // add to default order
    elt_id = bbop.uuid(); // generate the elt id we'll use from now on
    this.core["node2elt"][enid] = elt_id; // map it
    this.core["elt2node"][elt_id] = enid; // map it
    ret = true;
  }

  return ret;
};

/**
 * Add a node into the graph modeled from the the JSON-LD lite model.
 * Creates or adds types and annotations as necessary.
 *
 * @param {Object} indv - hash rep of graph individual from Minerva response?
 * @returns {node|null}
 */
noctua_graph.prototype.add_node_from_individual = function (indv) {
  var anchor = this;

  var new_node = null;

  // Add individual to edit core if properly structured.
  var iid = indv["id"];
  if (iid) {
    //var nn = new bbop.model.node(indv['id']);
    //var meta = {};
    //ll('indv');

    // See if there is type info that we want to add.
    // Create the node.
    var itypes = indv["type"] || [];
    var root_itypes = indv["root-type"] || [];
    var inf_itypes = indv["inferred-type"] || [];
    var inf_itypes_with_all = indv["inferred-type-with-all"] || [];
    new_node = anchor.create_node(iid, null, itypes, root_itypes, inf_itypes, inf_itypes_with_all);

    // See if there is type info that we want to add.
    var ianns = indv["annotations"] || [];
    if (us.isArray(ianns)) {
      // Add the annotations individually.
      each(ianns, function (ann_kv_set) {
        var na = new annotation(ann_kv_set);
        new_node.add_annotation(na);
      });
    }

    anchor.add_node(new_node);
  }

  return new_node;
};

/**
 * Return the "table" order of the nodes.
 *
 * @returns {Array} node order by id?
 */
noctua_graph.prototype.edit_node_order = function () {
  return this.core["node_order"] || [];
};

/**
 * Return a node's element id.
 *
 * @returns {String|null} node element id
 */
noctua_graph.prototype.get_node_elt_id = function (enid) {
  return this.core["node2elt"][enid] || null;
};

/**
 * Return a copy of a {node} by its element id.
 *
 * @returns {node|null} node
 */
noctua_graph.prototype.get_node_by_elt_id = function (elt_id) {
  var ret = null;
  var enid = this.core["elt2node"][elt_id] || null;
  if (enid) {
    ret = this.get_node(enid) || null;
  }
  return ret;
};

/**
 * Return a copy of a {node} by its corresponding Minerva JSON rep
 * individual.
 *
 * @returns {node|null} node
 */
noctua_graph.prototype.get_node_by_individual = function (indv) {
  var anchor = this;

  var ret = null;

  // Get node from graph if individual rep is properly structured.
  var iid = indv["id"];
  if (iid) {
    ret = this.get_node(iid) || null;
  }

  return ret;
};

/**
 * Return a hash of node ids to nodes.
 * Real, not a copy.
 *
 * @see module:bbop-graph#all_nodes
 * @returns {Object} node ids to nodes
 */
noctua_graph.prototype.get_nodes = function () {
  return this._nodes || {};
};

/**
 * Remove a node from the graph.
 *
 * @param {String} node_id - the id for a node
 * @param {Boolean} [clean_p] - remove all edges connects to node (default false)
 * @returns {Boolean} true if node found and destroyed
 */
noctua_graph.prototype.remove_node = function (node_id, clean_p) {
  var anchor = this;

  var ret = false;
  var enode = anchor.get_node(node_id);
  if (enode) {
    ret = true;

    ///
    /// First, remove all subclass decorations.
    ///

    // Also remove the node from the order list.
    // TODO: Is this a dumb scan?
    var ni = this.core["node_order"].indexOf(node_id);
    if (ni !== -1) {
      this.core["node_order"].splice(ni, 1);
    }

    // Clean the maps.
    var elt_id = this.core["node2elt"][node_id];
    delete this.core["node2elt"][node_id];
    delete this.core["elt2node"][elt_id];

    ///
    /// We want to maintain superclass compatibility.
    ///

    // Finally, remove the node itself.
    bbop_graph.prototype.remove_node.call(this, node_id, clean_p);
  }

  return ret;
};

/**
 * Add an edge to the graph. Remember that edges are no anonymous
 * edges here.
 *
 * @param {edge} eedge - a bbop-graph-noctua#edge
 */
noctua_graph.prototype.add_edge = function (eedge) {
  // Super.
  bbop_graph.prototype.add_edge.call(this, eedge);

  // Sub.
  var eeid = eedge.id();
  if (!eeid) {
    throw new Error("edge not of bbop-graph-noctua");
  }
  this.core["edges"][eeid] = eedge;
};

/**
 * Add an edge to the graph using a "fact" as the seed.
 * Creates and adds annotations as necessary.
 *
 * @param {} fact - JSON structure representing a fact
 * @returns {edge} newly created edge
 */
noctua_graph.prototype.add_edge_from_fact = function (fact) {
  var anchor = this;

  var new_edge = null;

  // Add individual to edit core if properly structured.
  var sid = fact["subject"];
  var oid = fact["object"];
  var pid = fact["property"];
  var plbl = fact["property-label"];
  var anns = fact["annotations"] || [];
  if (sid && oid && pid) {
    new_edge = anchor.create_edge(sid, oid, pid);
    if (!us.isArray(anns)) {
      throw new Error("annotations is wrong");
    } else {
      // Add the annotations individually.
      each(anns, function (ann_kv_set) {
        var na = new annotation(ann_kv_set);
        new_edge.add_annotation(na);
      });
    }
    // Add edge if possible.
    if (plbl) {
      new_edge.label(plbl);
    }

    // Add and ready to return edge.
    anchor.add_edge(new_edge);
  }

  return new_edge;
};

/**
 * Return an edge by is ID.
 *
 * @param {String} edge_id - the ID of the {edge}
 * @returns {edge|null} - the {edge}
 */
noctua_graph.prototype.get_edge_by_id = function (edge_id) {
  var ret = null;
  var ep = this.core["edges"][edge_id];
  if (ep) {
    ret = ep;
  }
  return ret;
};

/**
 * Return an edge ID by it's associated connector ID if extant.
 *
 * @param {String} cid - the ID of the connector.
 * @returns {String} - the ID of the associated edge
 */
noctua_graph.prototype.get_edge_id_by_connector_id = function (cid) {
  return this.core["connector2edge"][cid] || null;
};

/**
 * Return a connector by it's associated edge ID if extant.
 *
 * @param {String} eid - the ID of the edge
 * @returns {String} - the connector ID
 */
noctua_graph.prototype.get_connector_id_by_edge_id = function (eid) {
  return this.core["edge2connector"][eid] || null;
};

/**
 * Remove an edge to the graph.
 * The edge as referenced.
 *
 * @param {String} subject_id - subject by ID
 * @param {String} object_id - object by ID
 * @param {String} [predicate_id] - predicate ID or default
 * @returns {Boolean} true if such an edge was found and deleted, false otherwise
 */
// noctua_graph.prototype.remove_edge = function(subject_id, object_id, predicate_id){
//     var ret = false;

//     var eedge = this.get_edge(subject_id, object_id, predicate_id);
//     if( eedge ){
// 	ret = this.remove_edge_by_id(eedge.id());
//     }

//     return ret;
// };

/**
 * Remove an edge to the graph.
 * The edge as IDed.
 *
 * @param {String} edge_id - edge by ID
 * @returns {Boolean} true if such an edge was found and deleted, false otherwise
 */
noctua_graph.prototype.remove_edge_by_id = function (eeid) {
  var ret = false;

  if (this.core["edges"][eeid]) {
    // Summon up the edge to properly remove it from the model.
    var eedge = this.core["edges"][eeid];

    // Remove the node itself from super.
    ret = bbop_graph.prototype.remove_edge.call(
      this,
      eedge.subject_id(),
      eedge.object_id(),
      eedge.predicate_id(),
    );

    // Main bit out.
    delete this.core["edges"][eeid];

    // And clean the maps.
    var cid = this.core["edge2connector"][eeid];
    delete this.core["edge2connector"][eeid];
    delete this.core["connector2edge"][cid];
  }

  return ret;
};

/**
 * Internally connect an edge to a connector ID
 *
 * TODO/BUG: Should use generic ID mapping rather than depending on
 * jsPlumb thingamajunk.
 *
 * @deprecated
 * @param {edge} eedge - edge
 * @param {connector} connector - jsPlumb connector
 */
noctua_graph.prototype.create_edge_mapping = function (eedge, connector) {
  var eid = eedge.id();
  var cid = connector.id;
  this.core["edge2connector"][eid] = cid;
  this.core["connector2edge"][cid] = eid;
};

/**
 * Debugging text output function.
 *
 * Not sure what this is for anymore honestly...
 *
 * @deprecated
 * @returns {String} a graph rep as a string
 */
noctua_graph.prototype.dump = function () {
  //
  var dcache = [];

  each(this.get_nodes(), function (node, node_id) {
    var ncache = ["node"];
    ncache.push(node.id());
    dcache.push(ncache.join("\t"));
  });

  each(this.core["edges"], function (edge, edge_id) {
    var ecache = ["edge"];
    ecache.push(edge.subject_id());
    ecache.push(edge.predicate_id());
    ecache.push(edge.object_id());
    dcache.push(ecache.join("\t"));
  });

  return dcache.join("\n");
};

/**
 * Merge another graph (addition) into the current graph. Includes the
 * copying of annotations for the graph. This is an /additive/
 * operation (e.g. annotations and other non-unique entities
 * accumulate). Graph ID is /not/ copied.
 *
 * modified-p and inconsistent-p properties are copied from the the
 * incoming graph (assuming that the update has more recent
 * information).
 *
 * @param {graph} in_graph - the graph to merge in
 * @returns {Boolean} if graph was loaded
 */
noctua_graph.prototype.merge_in = function (in_graph) {
  var anchor = this;

  var ret = bbop_graph.prototype.merge_in.call(anchor, in_graph);

  // Function to check if two annotations are the same.
  function _is_same_ann(a1, a2) {
    var ret = false;
    if (a1.key() === a2.key() && a1.value() === a2.value() && a1.value_type() === a2.value_type()) {
      ret = true;
    }
    return ret;
  }

  // Merge in graph annotations.
  var in_graph_anns = in_graph.annotations();
  each(in_graph_anns, function (ann) {
    // If there are no annotations that have the same KVT triple,
    // add a clone.
    if (
      anchor.get_annotations_by_filter(function (a) {
        return _is_same_ann(ann, a);
      }).length === 0
    ) {
      anchor.add_annotation(ann.clone());
    }
  });

  // Accept the signal that the merge in graph (update) has the
  // correct modification and inconsistent information.
  anchor._inconsistent_p = in_graph._inconsistent_p;
  anchor._modified_p = in_graph._modified_p;

  // Accept the signal that the merge in graph (update) has the
  // correct validation/violation information.
  // TODO: Ask @goodb what the semantics are for different
  // signals when the reasoner are on--I'm assuming we clobber
  // here.
  anchor._violations = [];
  each(in_graph._violations, function (violation) {
    anchor._violations.push(violation.clone());
  });
  anchor._valid_p = in_graph._valid_p;
  anchor._valid_owl_p = in_graph._valid_owl_p;
  anchor._valid_shex_p = in_graph._valid_shex_p;

  return ret;
};

/**
 * Merge another graph into the current graph, with special overwrite
 * rules. In essence, this could be used when trying to simulate a
 * rebuild even though you got merge data.
 *
 * Annotations in any top-level item (graph, node, edge), or lack
 * thereof, from the incoming graph is preferred.
 *
 * All extant edges and nodes in the incoming graph are clobbered.
 *
 * The incoming graph is considered to be "complete", so any edges
 * where both the source and sink are in the incoming graph are
 * considered to be the only edges between those node.
 *
 * Graph ID is /not/ copied.
 *
 * Beware that you're in the right folded mode.
 *
 * @param {graph} in_graph - the graph to merge in
 * @returns {Boolean} if graph was loaded
 */
noctua_graph.prototype.merge_special = function (in_graph) {
  var anchor = this;

  // Since we can actually legally have an edge delete in the
  // merge, let's go ahead and cycle through the "complete"
  // graph and toss edges from individuals involved in the
  // merge.
  var involved_node = {};
  each(in_graph.all_nodes(), function (node) {
    involved_node[node.id()] = true;
  });
  // Okay, now get rid of all edges that are defined by the
  // involved nodes.
  each(anchor.all_edges(), function (edge) {
    if (involved_node[edge.subject_id()] && involved_node[edge.object_id()]) {
      anchor.remove_edge_by_id(edge.id());
    }
  });

  // Blitz our old annotations as all new will be incoming (and
  // the merge just takes the superset). Will be fine with fix:
  // https://github.com/geneontology/minerva/issues/5
  anchor.annotations([]);

  var ret = anchor.merge_in(in_graph);
  return ret;
};

/**
 * DEPRECATED
 *
 * This uses a subgraph to update the contents of the current
 * graph. The update graph is considered to be an updated complete
 * self-contained subsection of the graph, clobbering nodes, edges,
 * and the graph annotations. In the case of edges, all edges for the
 * incoming nodes are deleted, and the ones described in the incoming
 * graph are added (again, update).
 *
 * For example: you can think of it like this: if we have a graph:
 *  A, B, C, and A.1, where A, B, and C are nodes and A.1 is an annotation for A.
 * And we have an argument subgraph:
 *  A, B, and edge (A,B), and A.2, B.1.
 * The final graph would be:
 *  A, B, C and edge (A,B), and A.2, B.1.
 *
 * Essentially, any entity in the new graph clobbers the "old"
 * version; nodes not mentioned are left alone, the subgraph edges are
 * assumed to be complete with reference to the contained nodes. This
 * can express removal of things like annotations and sometimes edges,
 * but not of nodes and edges not contained in within the subgraph.
 *
 * See the unit tests for examples.
 *
 * Be careful of what happens when using with the various loaders as
 * the contents of top-level entities can be very different--you
 * probably want to apply the right loader first.
 *
 * @deprecated
 * @param {graph} in_graph - the graph to update with
 * @returns {Boolean} if graph was loaded
 */
noctua_graph.prototype.update_with = function (update_graph) {
  var anchor = this;

  // Prefer the new graph annotations by nuking the old.
  anchor._annotations = [];
  var update_graph_anns = update_graph.annotations();
  each(update_graph_anns, function (ann) {
    anchor.add_annotation(ann.clone());
  });

  // Next, look at individuals/nodes for addition or updating.
  var updatable_nodes = {};
  each(update_graph.all_nodes(), function (ind) {
    // Update node by clobbering. This is preferred since deleting
    // it would mean that all the connections would have to be
    // reconstructed as well.
    var update_node = anchor.get_node(ind.id());
    if (update_node) {
      //console.log('update node: ' + ind.id());
    } else {
      //console.log('add new node' + ind.id());
    }
    // Mark as a modified node.
    updatable_nodes[ind.id()] = true;
    // Add new node to edit core.
    anchor.add_node(ind.clone());
  });

  // Now look at edges (by individual) for purging and
  // reinstating--no going to try and update edges, just clobber.
  each(update_graph.all_nodes(), function (source_node) {
    //console.log('looking at node: ' + source_node.id());

    // Look up what edges it has in /core/, as they will be the
    // ones to update.
    var snid = source_node.id();
    var src_edges = anchor.get_edges_by_subject(snid);

    // Delete all edges for said node in model. We cannot
    // (apparently?) go from connection ID to connection easily,
    // so removing from UI is a separate step.
    each(src_edges, function (src_edge) {
      // Remove from model.
      var removed_p = anchor.remove_edge_by_id(src_edge.id());
      //console.log('remove edge (' + removed_p + '): ' + src_edge.id());
    });
  });

  // All edges should have IDs, so get them out of the graph if they
  // are incoming.
  each(update_graph.all_edges(), function (edge) {
    var in_id = edge.id();
    anchor.remove_edge_by_id(in_id);
    anchor.add_edge(edge.clone());
  });

  return true;
};

/**
 * Load minerva data response.
 *
 * TODO: inferred individuals
 *
 * @param {Object} the "data" portion of a Minerva graph-related response.
 * @returns {Boolean} if data was loaded
 */
noctua_graph.prototype.load_data_basic = function (data) {
  var anchor = this;

  var ret = false;

  if (data) {
    // Add the graph metadata.
    var graph_id = data["id"] || null;
    var graph_anns = data["annotations"] || [];
    if (graph_id) {
      anchor.id(graph_id);
    }
    if (!us.isEmpty(graph_anns)) {
      each(graph_anns, function (ann_kv_set) {
        var na = new annotation(ann_kv_set);
        anchor.add_annotation(na);
      });
    }

    // Add the additional metadata.
    if (typeof data["inconsistent-p"] !== "undefined") {
      anchor._inconsistent_p = data["inconsistent-p"];
    }
    if (typeof data["modified-p"] !== "undefined") {
      anchor._modified_p = data["modified-p"];
    }

    // Validation/violation information. Currently, this will only
    // be entered if the reasoner is on.
    if (
      typeof data["validation-results"] !== "undefined" &&
      us.isObject(data["validation-results"])
    ) {
      var vres = data["validation-results"];

      // Top level.
      if (us.isBoolean(vres["is-conformant"])) {
        if (vres["is-conformant"] === true) {
          anchor._valid_p = true;
        } else if (vres["is-conformant"] === false) {
          anchor._valid_p = false;
        }
      }

      // OWL.
      if (vres["owl-validation"] && us.isObject(vres["owl-validation"])) {
        if (vres["owl-validation"]["is-conformant"] === true) {
          anchor._valid_owl_p = true;
        } else if (vres["owl-validation"]["is-conformant"] === false) {
          anchor._valid_owl_p = false;
        }
      }

      // ShEx.
      if (vres["shex-validation"] && us.isObject(vres["shex-validation"])) {
        if (vres["shex-validation"]["is-conformant"] === true) {
          anchor._valid_shex_p = true;
        } else if (vres["shex-validation"]["is-conformant"] === false) {
          anchor._valid_shex_p = false;
        }
      }

      // Collect into violation objects; currently just ShEx.
      if (
        vres["shex-validation"] &&
        us.isObject(vres["shex-validation"]) &&
        us.isArray(vres["shex-validation"]["violations"])
      ) {
        var violations = vres["shex-validation"]["violations"] || [];
        each(violations, function (raw_v) {
          var new_v = new violation(raw_v);
          anchor._violations.push(new_v);
        });
      }
    }

    // Easy facts.
    var facts = data["facts"];
    each(facts, function (fact) {
      anchor.add_edge_from_fact(fact);
    });

    // Build the structure of the graph in the most obvious way.
    var inds = data["individuals"];
    each(inds, function (ind) {
      anchor.add_node_from_individual(ind);
    });

    ret = true;
  }

  return ret;
};

/**
 * Extract all of the evidence seeds from the graph--nodes and edges.
 *
 * An evidence seed is a: 1) real node in the graph that 2) is
 * referenced by the value of a node or edge special evidence
 * annotation.
 *
 * @returns {Object} a map of seeds (by id) to their referencing enity {node} or {edge}
 */
noctua_graph.prototype.extract_evidence_seeds = function () {
  var anchor = this;

  // Take and, and see if it is an evidence reference.
  function is_iri_ev_p(ann) {
    var ret = false;
    if (ann.key() === "evidence" && ann.value_type() === "IRI") {
      ret = true;
    }
    return ret;
  }

  // For any node, look at all of the annotations, and fold in
  // ones that 1) pass the test and 2) reference a singleton
  // node.
  var seeds = {}; // collect all possibilities here
  function pull_seeds(entity, test_p) {
    each(entity.annotations(), function (ann) {
      //console.log(ann.key(), ann.value_type(), ann.value());

      // Is it an evidence annotation.
      if (!test_p(ann)) {
        // Skip.
        //console.log('skip folding with failed test');
      } else {
        //console.log('start folding with passed test');

        // If so, and the individual in question exists, it is
        // the jumping off point for the evidence folding
        // subgraph.
        var ref_node_id = ann.value();
        var ref_node = anchor.get_node(ref_node_id);
        if (ref_node) {
          seeds[ref_node_id] = entity;
        }
      }
    });
  }

  // Cycle through everything and collect them.
  each(anchor.all_nodes(), function (node) {
    pull_seeds(node, is_iri_ev_p);
  });
  each(anchor.all_edges(), function (edges) {
    pull_seeds(edges, is_iri_ev_p);
  });

  return seeds;
};

/**
 * Extract the entire super clique subgraph for an entity.
 *
 * The ID for the graph will be the ID of the seed node.
 *
 * BUG/WARNING: The clique actually needs to use the walker rather
 * than the anc/desc functions it uses now.
 *
 * @param {String} node_id the ID of the see node in an evidence clique
 * @returns {graph} a list of found seeds as {node} ids
 */
noctua_graph.prototype.get_evidence_clique = function (node_id) {
  var anchor = this;

  // Create the clique by grabbing all nodes and creating a walkable
  // neighborhood.
  var up = anchor.get_ancestor_subgraph(node_id);
  //console.log("UP: ", up);
  var down = anchor.get_descendent_subgraph(node_id);
  //console.log("DOWN: ", down);
  up.merge_in(down);

  up.id(node_id);

  var ret = up;
  return ret;
};

/**
 * Extract an evidence subclique starting at a seed node.
 *
 * A subclique is a subgraph within a clique that represents a piece
 * of evidence, and may overlap with other pieces of evidence.
 *
 * The ID for the graph will be the ID of the seed node.
 *
 * Returns a clone.
 *
 * TODO: More to do as we expand what the evidence subgraphs look
 * like.
 *
 * @param {String} node_id the ID of the seed node in an evidence clique - it is *assumed* that this is a legit seed node id
 * @returns {graph|null} a list of found seeds as {node} ids
 */
noctua_graph.prototype.get_evidence_subclique = function (node_id) {
  var anchor = this;

  var ret = null;

  // Must have a seed to start.
  var seed_node = anchor.get_node(node_id);
  if (seed_node) {
    // Start a new graph here. If this is the traditional simple
    // GO model, we also stop here.
    var ret_graph = anchor.create_graph();
    ret_graph.id(node_id);
    ret_graph.add_node(seed_node.clone());

    // For more complicated PMID evidence, we need to walk a
    // little deeper.
    // Add the kids...
    var kids = anchor.get_child_nodes(seed_node.id(), "IAO:0000136");
    if (!us.isEmpty(kids)) {
      each(kids, function (kid) {
        var klone = kid.clone();
        ret_graph.add_node(klone);
      });
      // ...and create new edges.
      var keds = anchor.get_child_edges(seed_node.id(), "IAO:0000136");
      each(keds, function (ked) {
        var klone = ked.clone();
        ret_graph.add_edge(klone);
      });

      // TODO: Dig down deeper from here for publication.
    }

    // TODO: Dig down deeper from here for non-publication.

    // This is what we'll return.
    ret = ret_graph;
  }

  return ret;
};

/**
 * Fold the evidence individuals into the edges and nodes that
 * reference them under the referenced_subgraph functions.
 *
 * Currently, a single pass is run to fold evidence subgraphs
 * (sometimes containing a single node) into other nodes/edges as
 * referenced subgraphs. However, additional passes can very easily be
 * added to fold away references to references as long as a matching
 * function is provided.
 *
 * @returns {Boolean} if data was loaded
 */
noctua_graph.prototype.fold_evidence = function () {
  var anchor = this;

  var ret = false;

  // We are going to fold by clique.
  var seeds = anchor.extract_evidence_seeds();
  //console.log('seeds', us.keys(seeds));

  // Get the cliques (super-neighborhood evidence) and get a map of
  // what seeds are in each clique. Instead of comparing cliques to
  // eliminate dupes (it's possible to have shared structure), we
  // just keep checking the seeds, marking the ones that we've seen
  // so we don't check again.
  //
  // This section produces a clique map and a clique to sed map.
  //
  var cliques = {}; // clique_id->clique
  var clique_seed_map = {}; // clique_id->{seeds->true, in->true, clique->true}
  var skippable_seeds = {}; // once we see a seed, we can skip it afterwards
  each(seeds, function (referncing_entity, seed_id) {
    //console.log('seed_id', seed_id);
    if (!skippable_seeds[seed_id]) {
      // skip uneeded ones

      // Get clique.
      var clique = anchor.get_evidence_clique(seed_id);
      var clique_id = clique.id();
      //console.log(' clique_id', clique_id);
      //console.log(' clique', clique);

      // Ready clique map.
      clique_seed_map[clique_id] = {};

      //
      each(seeds, function (check_referencing_entity, check_seed_id) {
        if (!skippable_seeds[check_seed_id]) {
          // skip uneeded ones
          //console.log(' pass', check_seed_id);

          //
          if (clique.get_node(check_seed_id)) {
            //console.log(' in clique:', check_seed_id);

            // Add seed to map and skippable.
            clique_seed_map[clique_id][check_seed_id] = true;
            skippable_seeds[check_seed_id] = true;
            cliques[clique_id] = clique;
            // console.log('seed',check_seed_id,
            // 	    '\n in clique',clique_id);
          } else {
            // Pass.
            // console.log('seed',check_seed_id,
            // 	    'not in clique',clique_id);
          }
        }
      });
    }
  });

  //console.log('cliques', cliques);
  //console.log('cliques', us.keys(cliques));
  //console.log('clique_seed_map', clique_seed_map);

  // Okay, we will do the folding on a clique-by-clique basis. See
  // the top of the file for rules.
  each(cliques, function (clique, clique_id) {
    //console.log('clique_id', clique_id);

    // Nodes in the clique.
    var clique_nodes = {};
    each(clique.all_nodes(), function (cn) {
      var cnid = cn.id();
      clique_nodes[cnid] = true;
    });

    // Collect the subcliques for every clique.
    var contained_seed_map = clique_seed_map[clique_id];
    //console.log('csm', contained_seed_map);
    var subcliques = {};
    each(contained_seed_map, function (bool, seed_id) {
      var subclique = anchor.get_evidence_clique(seed_id);
      //console.log(subclique);

      // Add to cache of subcliques.
      subcliques[seed_id] = subclique;

      // Mark out all of the clique_nodes seen.
      each(subclique.all_nodes(), function (sub_node) {
        var snid = sub_node.id();
        if (clique_nodes[snid]) {
          delete clique_nodes[snid];
        }
      });
    });

    //console.log('clique_nodes', clique_nodes);
    //console.log('subcliques', subcliques);

    // Okay, if the clique_nodes map is empty, that means it is
    // completely covered by the subcliques and can be removed.
    if (!us.isEmpty(clique_nodes)) {
      //console.log(' cannot fold clique due to maigo no node');
    } else {
      // Add subcliques to initial referring nodes.
      each(subcliques, function (subclique, seed_id) {
        // Make sure that we fold into the original node of
        // the original graph.
        var origin_entity = seeds[seed_id]; // still a copy
        if (!origin_entity) {
          // console.log('skip addition (possibly edge uuid)');
          // console.log('skip addition over (A)', seed_id);
          // console.log('skip addition over (B)',
          // 		origin_node_clone_maybe.id());
        } else {
          // Since origin_entity is a copy, we'll modify it
          // and re-add it to the graph to make change
          // permanent.
          origin_entity.add_referenced_subgraph(subclique);
          // clobber non-ref version
          var entity_is = bbop.what_is(origin_entity);
          //console.log(entity_is, entity_is);
          if (entity_is === "bbop-graph-noctua.node") {
            anchor.add_node(origin_entity);
          } else if (entity_is === "bbop-graph-noctua.edge") {
            anchor.add_edge(origin_entity);
          } else {
            // Very Bad.
            log("ERROR: attempt to clobber unknown entity");
          }
        }
      });

      // Disolve the entire clique from graph, depending on edge
      // to auto-disolve.
      each(clique.all_nodes(), function (removable_cn, cni) {
        //console.log('remove', cni , removable_cn.id());
        //console.log(anchor.remove_node(removable_cn.id(), true));
        anchor.remove_node(removable_cn.id(), true);
      });
    }
  });

  ret = true;

  return ret;
};

/**
 * In addition to everything we did for {fold_evidence},
 * we're going to search for nodes that have enabled_by and/or
 * occurs_in (or any other specified relation) targets (that are
 * themselves leaves) fold them in to the contained subgraph item, and
 * remove them from the top-level graph.
 *
 * TODO: inferred individuals
 *
 * @param {Array} relation_list of relations (as strings) to scan for for collapsing
 * @param {Array} relation_reverse_list of relations (as strings) to scan for for collapsing in the opposite direction.
 * @returns {Boolean} if data was loaded
 */
noctua_graph.prototype.fold_go_noctua = function (relation_list, relation_reverse_list) {
  var anchor = this;

  // Start out with the evidence folded graph.
  var ret = anchor.fold_evidence();
  if (!ret) {
    return false;
  } // Early bail on bad upstream.

  // It is foldable if it is a root node (re: opposite of leaf--only
  // target) and if it only has the one child (no way out--re: collapsible ).
  function _foldable_p(node) {
    var ret = false;
    // console.log("  " + dd(node.id()));
    if (
      anchor.is_root_node(node.id()) &&
      !node.subgraph() && // cannot fold if already folded into
      anchor.get_child_nodes(node.id()).length === 1
    ) {
      // console.log("    Y root_p: " +
      // 	    anchor.is_root_node(node.id()) +
      // 	    ";  kids: " +
      // 	    anchor.get_child_nodes(node.id()).length);
      ret = true;
    } else {
      // console.log("    N root_p: " +
      // 	    anchor.is_root_node(node.id()) +
      // 	    ";  kids: " +
      // 	    anchor.get_child_nodes(node.id()).length);
    }
    return ret;
  }

  // It is reverse foldable if it is a leaf node (re: opposite of
  // root--only source) and if it only has the one child (no way
  // out--re: collapsible ).
  function _reverse_foldable_p(node) {
    var ret = false;
    if (
      anchor.is_leaf_node(node.id()) &&
      !node.subgraph() && // cannot fold if already folded into
      anchor.get_parent_nodes(node.id()).length === 1
    ) {
      //console.log("is foldable: " + node.id());
      ret = true;
    } else {
      //console.log("not foldable: " + node.id());
    }
    // console.log("  leaf_p: " + anchor.is_leaf_node(node.id()) +
    // 	    ";  parents: " + anchor.get_parent_nodes(node.id()).length);
    return ret;
  }

  // Okay, first scan all nodes for our pattern.
  // each(anchor.all_nodes(), function(pattern_seed_indv){
  // Temporarily enforce an ordering so we can debug/have consistent
  // results.
  var todo_nodes = anchor.all_nodes();
  todo_nodes = todo_nodes.sort(function (a, b) {
    //console.log(a.id()+' vs. '+ b.id() +': '+a.id().localeCompare(b.id()));
    return a.id().localeCompare(b.id());
  });
  each(todo_nodes, function (pattern_seed_indv) {
    //console.log( dd(pattern_seed_indv.id()) );

    var pattern_seed_id = pattern_seed_indv.id();

    // The possible base subgraph (seeding with current node--note
    // the clone so we don't have infinite recursion) we might
    // capture.
    var subgraph = anchor.create_graph();
    subgraph.add_node(pattern_seed_indv.clone());

    // Fold checking is independent of reverse or not.
    var fold_occurred_p = false;

    // Check a set of relations for completeness.
    var collapsable_relations = relation_list || [];
    each(collapsable_relations, function (relation) {
      var parents = anchor.get_parent_nodes(pattern_seed_id, relation);
      each(parents, function (parent) {
        if (_foldable_p(parent)) {
          fold_occurred_p = true;

          // Preserve it and its edge in the new subgraph.
          var p = parent.clone();
          // if( p.subgraph() ){
          // 	console.log('  has SUB');
          // }
          subgraph.add_node(p);
          var eta = anchor.get_edge(pattern_seed_id, p.id(), relation);
          subgraph.add_edge(eta.clone());
          // subgraph.report_state();

          // Remove same from the original graph, edge will be
          // destroyed in the halo.
          anchor.remove_node(parent.id(), true);
          // console.log('  *destroyed: ' + dd(parent.id()) );
        }
      });
    });

    // ...and now the other way.
    var collapsable_reverse_relations = relation_reverse_list || [];
    each(collapsable_reverse_relations, function (relation) {
      var children = anchor.get_child_nodes(pattern_seed_id, relation);
      each(children, function (child) {
        if (_reverse_foldable_p(child)) {
          fold_occurred_p = true;

          // Preserve it and its edge in the new subgraph.
          subgraph.add_node(child.clone());
          subgraph.add_edge(
            // we know it's just one from above
            anchor.get_child_edges(pattern_seed_id, relation)[0].clone(),
          );

          // Remove same from the original graph, edge will
          // be destroyed in the halo.
          anchor.remove_node(child.id(), true);
        }
      });
    });

    // A usable folding subgraph only occurred when the are more
    // than 1 node in it; i.e. we actually actually added things
    // to our local subgraph and removed them from the master
    // graph.
    if (fold_occurred_p) {
      // console.log('slurpable subgraph ('+ subgraph.all_nodes().length +
      // 		') for: ' + pattern_seed_id);
      pattern_seed_indv.subgraph(subgraph);
    }
  });

  return ret;
};

/**
 * Essentially, undo anything that could be done in a folding
 * step--return the graph to its most expanded form.
 *
 * @param {Object} [incoming_graph] subgraph to unfold into the calling graph (default behaviour would be calling itself; only really used internally by this method for recursion)
 * @returns {Boolean} if unfolded (should always be true)
 */
noctua_graph.prototype.unfold = function (incoming_graph) {
  var anchor = this;

  // If not a recursive, we will operate on ourselves.
  if (!incoming_graph) {
    incoming_graph = anchor;
  }

  // For any entity, remove its referenced individuals and re-add
  // them to the graph.
  function _unfold_subgraph(sub) {
    // Restore to graph.
    // console.log('   unfold # (' + sub.all_nodes().length + ', ' +
    // 	    sub.all_edges().length + ')');
    each(sub.all_nodes(), function (node) {
      anchor.add_node(node);
    });
    each(sub.all_edges(), function (edge) {
      anchor.add_edge(edge);
    });
  }

  // Apply to all nodes.
  each(incoming_graph.all_nodes(), function (node) {
    // Get references (ev).
    var ref_graphs = node.referenced_subgraphs();

    // Restore to graph.
    each(ref_graphs, function (sub) {
      _unfold_subgraph(sub);
    });

    // Remove references.
    node.referenced_subgraphs([]);

    // Now that they've been removed (to help prevent loops) try
    // and recur.
    each(ref_graphs, function (sub) {
      anchor.unfold(sub);
    });

    // Repeat with any absorbed subgraph.
    var asub = node.subgraph();
    if (asub) {
      _unfold_subgraph(asub);
      node.subgraph(null); // eliminate after it has been re-added
      // Recur on any found subgraphs, safer since the elimination.
      anchor.unfold(asub);
    }
  });

  // Apply to all edges.
  each(incoming_graph.all_edges(), function (edge) {
    // Get references (ev).
    var ref_graphs = edge.referenced_subgraphs();

    // Restore to graph.
    each(ref_graphs, function (sub) {
      _unfold_subgraph(sub);
    });

    // Remove references.
    edge.referenced_subgraphs([]);

    // Now that they've been removed, try and recur (to help
    // prevent loops).
    each(ref_graphs, function (sub) {
      anchor.unfold(sub);
    });
  });

  // Revisit if we want something meaningful out of here.
  var retval = true;
  return retval;
};

/**
 * Provide a verbose report of the current state of the graph and
 * subgraphs. Writes using console.log; only to be used for debugging.
 *
 * @returns {null} just the facts
 */
noctua_graph.prototype.report_state = function (incoming_graph, indentation) {
  var anchor = this;

  // If not a recursive, we will operate on ourselves.
  if (!incoming_graph) {
    incoming_graph = anchor;
  }

  // Start with no indentation.
  if (typeof indentation === "undefined") {
    indentation = 0;
  }

  // Collect spacing for this indentation level of logging.
  var spacing = "";
  for (var i = 0; i < indentation; i++) {
    spacing += "   ";
  }
  function ll(str) {
    log(spacing + str);
  }
  function short(str) {
    return str.substr(str.length - 16);
  }

  // Restore to graph.
  var gid = incoming_graph.id() || "(anonymous graph)";
  ll(gid);
  ll(
    " entities # (" +
      incoming_graph.all_nodes().length +
      ", " +
      incoming_graph.all_edges().length +
      ")",
  );

  // Show node information, arbitrary, but fixed, order.
  each(
    incoming_graph.all_nodes().sort(function (a, b) {
      if (a.id() > b.id()) {
        return 1;
      } else if (a.id() < b.id()) {
        return -1;
      }
      return 0;
    }),
    function (node) {
      ll(" node: " + dd(node.id()));

      // Subgraph.
      var subgraph = node.subgraph();
      if (subgraph) {
        ll("  subgraph: ");
        anchor.report_state(subgraph, indentation + 1);
      }

      // Refs.
      var ref_graphs = node.referenced_subgraphs();
      if (ref_graphs.length > 0) {
        ll("  references: ");
        each(ref_graphs, function (sub) {
          anchor.report_state(sub, indentation + 1);
        });
      }
    },
  );

  // Show edge information, arbitrary, but fixed, order.
  each(
    incoming_graph.all_edges().sort(function (a, b) {
      if (a.id() > b.id()) {
        return 1;
      } else if (a.id() < b.id()) {
        return -1;
      }
      return 0;
    }),
    function (edge) {
      var s = dd(edge.subject_id());
      var o = dd(edge.object_id());
      var p = dd(edge.predicate_id());
      //ll(' edge: ' + edge.id());
      ll(" edge: " + s + ", " + o + ": " + p);

      // Refs.
      var ref_graphs = edge.referenced_subgraphs();
      if (ref_graphs.length > 0) {
        ll("  references: ");
        each(ref_graphs, function (sub) {
          anchor.report_state(sub, indentation + 1);
        });
      }
    },
  );

  if (!us.isEmpty(incoming_graph._os_table)) {
    log(spacing + "OS:", incoming_graph._os_table);
  }
  if (!us.isEmpty(incoming_graph._so_table)) {
    log(spacing + "SO:", incoming_graph._so_table);
  }
  if (!us.isEmpty(incoming_graph._predicates)) {
    log(spacing + "PRED:", incoming_graph._predicates);
  }

  return null;
};

///
/// Node subclass and overrides.
///

var bbop_node = bbop_model.node;
/**
 * Sublcass of bbop-graph.node for use with Noctua ideas and concepts.
 *
 * @constructor
 * @see module:bbop-graph
 * @alias node
 * @param {String} [in_id] - new id; otherwise new unique generated
 * @param {String} [in_label] - node "label"
 * @param {Array} [in_types] - list of Objects or strings--anything that can be parsed by class_expression
 * @param {Array} [in_inferred_types] - list of Objects or strings--anything that can be parsed by class_expression
 * @returns {this}
 */
function noctua_node(
  in_id,
  in_label,
  in_types,
  in_root_types,
  in_inferred_types,
  in_inferred_types_with_all,
) {
  bbop_node.call(this, in_id, in_label);
  this._is_a = "bbop-graph-noctua.node";
  var anchor = this;

  // Let's make this an OWL-like world.
  this._types = [];
  this._id2type = {}; // contains map to both types and inferred types
  this._root_types = [];
  this._inferred_types = [];
  this._inferred_types_with_all = [];
  this._annotations = [];
  this._referenced_subgraphs = [];
  this._embedded_subgraph = null;

  // Incoming ID or generate ourselves.
  if (typeof in_id === "undefined") {
    this._id = bbop.uuid();
  } else {
    this._id = in_id;
  }

  // Roll in any types that we may have coming in.
  if (us.isArray(in_types)) {
    each(in_types, function (in_type) {
      var new_type = new class_expression(in_type);
      anchor._id2type[new_type.id()] = new_type;
      anchor._types.push(new class_expression(in_type));
    });
  }
  // Same with root types.
  if (us.isArray(in_root_types)) {
    each(in_root_types, function (in_root_type) {
      var new_root_type = new class_expression(in_root_type);
      anchor._id2type[new_root_type.id()] = new_root_type;
      anchor._root_types.push(new class_expression(in_root_type));
    });
  }
  // Same with inferred types.
  if (us.isArray(in_inferred_types)) {
    each(in_inferred_types, function (in_inferred_type) {
      var new_type = new class_expression(in_inferred_type);
      anchor._id2type[new_type.id()] = new_type;
      anchor._inferred_types.push(new class_expression(in_inferred_type));
    });
  }
  // Same with inferred types with all.
  if (us.isArray(in_inferred_types_with_all)) {
    each(in_inferred_types_with_all, function (in_inferred_type_with_all) {
      var new_type = new class_expression(in_inferred_type_with_all);
      anchor._id2type[new_type.id()] = new_type;
      anchor._inferred_types_with_all.push(new class_expression(in_inferred_type_with_all));
    });
  }
}
bbop.extend(noctua_node, bbop_node);

/**
 * Get a fresh new copy of the current node (using bbop.clone for
 * metadata object).
 *
 * @returns {node} node
 */
noctua_node.prototype.clone = function () {
  var anchor = this;

  // Fresh.
  var new_clone = new noctua_node(
    anchor.id(),
    anchor.label(),
    anchor.types(),
    anchor.root_types(),
    anchor.inferred_types(),
    anchor.inferred_types_with_all(),
  );

  // Base class stuff.
  new_clone.type(this.type());
  new_clone.metadata(bbop.clone(this.metadata()));

  // Transfer over the new goodies, starting with annotations and
  // referenced individuals.
  each(anchor._annotations, function (annotation) {
    new_clone._annotations.push(annotation.clone());
  });
  each(anchor._referenced_subgraphs, function (sub) {
    new_clone._referenced_subgraphs.push(sub.clone());
  });

  // Embedded subgraph.
  if (anchor._embedded_subgraph) {
    new_clone._embedded_subgraph = anchor._embedded_subgraph.clone();
  } else {
    new_clone._embedded_subgraph = null;
  }

  return new_clone;
};

/**
 * Get current types; replace current types.
 *
 * Parameters:
 * @returns {Array} array of types
 */
noctua_node.prototype.types = function () {
  var anchor = this;
  return this._types;
};

/**
 * Get current root types; replace current root types.
 *
 * Parameters:
 * @returns {Array} array of types
 */
noctua_node.prototype.root_types = function () {
  var anchor = this;
  return this._root_types;
};

/**
 * Get current inferred types; replace current inferred types.
 *
 * Parameters:
 * @returns {Array} array of types
 */
noctua_node.prototype.inferred_types = function () {
  var anchor = this;
  return this._inferred_types;
};

/**
 * Get current inferred types with all; replace current inferred types.
 *
 * Parameters:
 * @returns {Array} array of types
 */
noctua_node.prototype.inferred_types_with_all = function () {
  var anchor = this;
  return this._inferred_types_with_all;
};

/**
 * Add types to current types.
 *
 * Parameters:
 * @param {Object} in_types - raw JSON type objects
 * @param {Boolean} inferred_p - whether or not the argument types are inferred
 * @returns {Boolean} t|f
 */
noctua_node.prototype.add_types = function (in_types, inferred_p) {
  var anchor = this;
  var inf_p = inferred_p || false;

  var ret = false;

  if (us.isArray(in_types)) {
    each(in_types, function (in_type) {
      var new_type = new class_expression(in_type);
      anchor._id2type[new_type.id()] = new_type;
      if (!inferred_p) {
        anchor._types.push(new_type);
      } else {
        anchor._inferred_types.push(new_type);
        // And with_all, as it is a superset.
        anchor._inferred_types_with_all.push(new_type);
      }

      ret = true; // return true if did something
    });
  }
  return ret;
};

/**
 * If extant, get the type by its unique identifier. This works for
 * both inferred and non-inferred types generally.
 *
 * @param {String} type_id - type id
 * @returns {type|null} type or null
 */
noctua_node.prototype.get_type_by_id = function (type_id) {
  var anchor = this;

  var ret = null;
  ret = anchor._id2type[type_id];

  return ret;
};

/**
 * Essentially, get all of the "uneditable" root types from that are
 * not duplicated in the regular (editable) types listing.
 *
 * Returns originals.
 *
 * Note: the matching here is awful and should be redone (going by
 * very lossy string rep).
 *
 * @returns {Array} of {class_expression}
 */
noctua_node.prototype.get_unique_root_types = function () {
  var anchor = this;

  var ret = [];

  // Create a checkable representation of the types.
  var type_cache = {};
  each(anchor.types(), function (t) {
    type_cache[t.signature()] = true;
  });

  // Do a lookup.
  each(anchor.root_types(), function (t) {
    if (!type_cache[t.signature()]) {
      ret.push(t);
    }
  });

  return ret;
};

/**
 * Essentially, get all of the "uneditable" direct inferred types from
 * the reasoner that are not duplicated in the regular (editable)
 * types listing.
 *
 * Returns originals.
 *
 * Note: the matching here is awful and should be redone (going by
 * very lossy string rep).
 *
 * @returns {Array} of {class_expression}
 */
noctua_node.prototype.get_unique_inferred_types = function () {
  var anchor = this;

  var ret = [];

  // Create a checkable representation of the types.
  var type_cache = {};
  each(anchor.types(), function (t) {
    type_cache[t.signature()] = true;
  });

  // Do a lookup.
  each(anchor.inferred_types(), function (t) {
    if (!type_cache[t.signature()]) {
      ret.push(t);
    }
  });

  return ret;
};

/**
 * Essentially, get all (the complete closure in this case) of the
 * "uneditable" inferred types from the reasoner that are not
 * duplicated in the regular (editable) types listing.
 *
 * Returns originals.
 *
 * Note: the matching here is awful and should be redone (going by
 * very lossy string rep).
 *
 * @returns {Array} of {class_expression}
 */
noctua_node.prototype.get_unique_inferred_types_with_all = function () {
  var anchor = this;

  var ret = [];

  // Create a checkable representation of the types.
  var type_cache = {};
  each(anchor.types(), function (t) {
    type_cache[t.signature()] = true;
  });

  // Do a lookup.
  each(anchor.inferred_types_with_all(), function (t) {
    if (!type_cache[t.signature()]) {
      ret.push(t);
    }
  });

  return ret;
};

/**
 * Get/set the "contained" subgraph. This subgraph is still considered
 * to be part of the graph, but is "hidden" under this node for most
 * use cases except serialization.
 *
 * To put it another way, unless you specifically load this with a
 * specialized loader, it will remain unpopulated. During
 * serialization, it should be recursively walked and dumped.
 *
 * @param {graph|null} [subgraph] - the subgraph to "hide" inside this individual in the graph, or null to reset it
 * @returns {graph|null} contained subgraph
 */
noctua_node.prototype.subgraph = function (subgraph) {
  if (typeof subgraph === "undefined") {
    // Just return current state.
  } else if (subgraph === null) {
    // Reset state (and return).
    this._embedded_subgraph = null;
  } else if (bbop.what_is(subgraph) === "bbop-graph-noctua.graph") {
    // Update state (and return).
    this._embedded_subgraph = subgraph;
  }
  return this._embedded_subgraph;
};

///
/// Edge subclass and overrides.
///

var bbop_edge = bbop_model.edge;
/**
 * Sublcass of bbop-graph.edge for use with Noctua ideas and concepts.
 *
 * @constructor
 * @see module:bbop-graph
 * @alias edge
 * @param {String} subject - required subject id
 * @param {String} object - required object id
 * @param {String} [predicate] - preidcate id; if not provided, will use defined default (you probably want to provide one--explicit is better)
 * @returns {this}
 */
function noctua_edge(subject, object, predicate) {
  bbop_edge.call(this, subject, object, predicate);
  this._is_a = "bbop-graph-noctua.edge";

  // Edges are not completely anonymous in this world.
  this._id = bbop.uuid();
  this._predicate_label = null;

  this._annotations = [];
  this._referenced_subgraphs = [];
}
bbop.extend(noctua_edge, bbop_edge);

/**
 * Get a fresh new copy of the current edge--no shared structure.
 *
 * @returns {edge} - new copy of edge
 */
noctua_edge.prototype.clone = function () {
  var anchor = this;

  // Fresh.
  var new_clone = new noctua_edge(anchor.subject_id(), anchor.object_id(), anchor.predicate_id());

  // Same id.
  new_clone._id = anchor._id;
  new_clone._predicate_label = anchor._predicate_label;

  // Base class stuff.
  new_clone.default_predicate = anchor.default_predicate;
  new_clone.type(anchor.type());
  new_clone.metadata(bbop.clone(anchor.metadata()));

  // Transfer over the new goodies.
  each(anchor._annotations, function (annotation) {
    new_clone._annotations.push(annotation.clone());
  });
  each(anchor._referenced_subgraphs, function (ind) {
    new_clone._referenced_subgraphs.push(ind.clone());
  });

  return new_clone;
};

/**
 * Access to the immutable "id".
 *
 * @returns {String} string
 */
noctua_edge.prototype.id = function () {
  return this._id;
};

/**
 * Get/set "source" of edge.
 *
 * @deprecated
 * @param {String} [value] - string
 * @returns {String} string
 */
noctua_edge.prototype.source = function (value) {
  if (value) {
    this._subject_id = value;
  }
  return this._subject_id;
};

/**
 * Get/set "target" of edge.
 *
 * @deprecated
 * @param {String} [value] - string
 * @returns {String} string
 */
noctua_edge.prototype.target = function (value) {
  if (value) {
    this._object_id = value;
  }
  return this._object_id;
};

/**
 * Get/set "relation" of edge.
 *
 * @deprecated
 * @param {String} [value] - string
 * @returns {String} string
 */
noctua_edge.prototype.relation = function (value) {
  if (value) {
    this._predicate_id = value;
  }
  return this._predicate_id;
};

/**
 * Access to the mutable "label" for the edge.
 *
 * @param {String} [value] - lbl
 * @returns {String|null} string
 */
noctua_edge.prototype.label = function (lbl) {
  if (lbl === null || typeof lbl === "string") {
    this._predicate_label = lbl;
  }
  return this._predicate_label;
};

// Add generic bulk annotation operations to: graph, edge, and node.
each([noctua_graph, noctua_node, noctua_edge], function (constructr) {
  constructr.prototype.annotations = _annotations;
  constructr.prototype.add_annotation = _add_annotation;
  constructr.prototype.get_annotations_by_filter = _get_annotations_by_filter;
  constructr.prototype.get_annotations_by_key = _get_annotations_by_key;
  constructr.prototype.get_annotation_by_id = _get_annotation_by_id;
});

// Add generic evidence (referenced individuals) operations to: edge
// and node.
each([noctua_node, noctua_edge], function (constructr) {
  constructr.prototype.referenced_subgraphs = _referenced_subgraphs;
  constructr.prototype.add_referenced_subgraph = _add_referenced_subgraph;
  constructr.prototype.get_referenced_subgraphs_by_filter = _get_referenced_subgraphs_by_filter;
  constructr.prototype.get_referenced_subgraph_by_id = _get_referenced_subgraph_by_id;
  constructr.prototype.get_referenced_subgraph_profiles = _get_referenced_subgraph_profiles;
  constructr.prototype.get_basic_evidence = _get_basic_evidence;
});

///
/// Exportable body.
///

export default {
  annotation: annotation,
  node: noctua_node,
  edge: noctua_edge,
  graph: noctua_graph,
};
