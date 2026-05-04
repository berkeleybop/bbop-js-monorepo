/**
 * Response handler for dealing with the parsing of responses from
 * Barista (enveloping Minerva).
 *
 * @module bbop-response-barista
 */

import bbop from "bbop-core";
import us from "underscore";
import bbopRestResponse from "bbop-rest-response";

var bbop_rest_response = bbopRestResponse.base;

/**
 * Constructor for a Minerva REST JSON response object.
 *
 * @constructor
 * @param {Object|String} raw - the JSON object as a string or object
 * @returns {response} response object
 */
var response = function (raw) {
  bbop_rest_response.call(this);
  this._is_a = "bbop-response-barista";

  this._uid = null;
  this._packet_id = null;
  this._intention = null;
  this._reasoner_p = null;
  this._groups = null;
  this._signal = null;
  this._commentary = null;
  this._data = null;

  this.okay(false);
  this._raw = null;

  if (!raw) {
    this.message("empty response in handler");
    this.message_type("error");
  } else {
    var itsa = bbop.what_is(raw);
    if (itsa !== "string" && itsa !== "object") {
      this.message("bad argument type in handler");
      this.message_type("error");
    } else {
      if (itsa === "string") {
        try {
          this._raw = JSON.parse(raw);
        } catch (_error) {
          this._raw = null;
          this.message(`handler could not parse string response: ${raw}`);
          this.message_type("error");
        }
      } else {
        this._raw = raw;
      }

      if (this._raw) {
        var jresp = this._raw;
        if (!jresp["message-type"] || !jresp.message) {
          this.message_type("error");
          this.message("message and message_type must always exist");
        } else {
          var cdata = jresp.commentary || null;
          var odata = jresp.data || null;

          if (odata && bbop.what_is(odata) !== "object") {
            this.message("data not object");
            this.message_type("error");
          } else if (cdata && bbop.what_is(cdata) !== "string") {
            this.message("commentary not string");
            this.message_type("error");
          } else {
            this.okay(true);

            this.message_type(jresp["message-type"]);
            this.message(jresp.message);

            this._uid = jresp.uid || "unknown";
            this._intention = jresp.intention || "unknown";
            this._reasoner_p = false;
            if (typeof jresp["is-reasoned"] === "boolean") {
              this._reasoner_p = jresp["is-reasoned"];
            }
            if (us.isArray(jresp["provided-by"]) && !us.isEmpty(jresp["provided-by"])) {
              this._groups = jresp["provided-by"];
            }
            this._signal = jresp.signal || "unknown";
            this._packet_id = jresp["packet-id"] || "unknown";

            if (cdata) {
              this._commentary = cdata;
            }
            if (odata) {
              this._data = odata;
            }
          }
        }
      }
    }
  }
};
bbop.extend(response, bbop_rest_response);

response.prototype.user_id = function () {
  return this._uid || null;
};

response.prototype.intention = function () {
  return this._intention || null;
};

response.prototype.reasoner_p = function () {
  return this._reasoner_p;
};

response.prototype.groups = function () {
  return this._groups;
};

response.prototype.provided_by = response.prototype.groups;

response.prototype.signal = function () {
  return this._signal || null;
};

response.prototype.packet_id = function () {
  return this._packet_id || null;
};

response.prototype.commentary = function () {
  var ret = null;
  if (this._commentary) {
    ret = bbop.clone(this._commentary);
  }
  return ret;
};

response.prototype.data = function () {
  var ret = null;
  if (this._data) {
    ret = bbop.clone(this._data);
  }
  return ret;
};

response.prototype.model_id = function () {
  var ret = null;
  if (this._data && this._data.id) {
    ret = this._data.id;
  }
  return ret;
};

response.prototype.inconsistent_p = function () {
  var ret = false;
  if (
    this._data &&
    typeof this._data["inconsistent-p"] !== "undefined" &&
    this._data["inconsistent-p"] === true
  ) {
    ret = true;
  }
  return ret;
};

response.prototype.modified_p = function () {
  var ret = false;
  if (
    this._data &&
    typeof this._data["modified-p"] !== "undefined" &&
    this._data["modified-p"] === true
  ) {
    ret = true;
  }
  return ret;
};

response.prototype.has_undo_p = function () {
  return Boolean(
    this._data && this._data.undo && us.isArray(this._data.undo) && this._data.undo.length > 0,
  );
};

response.prototype.has_redo_p = function () {
  return Boolean(
    this._data && this._data.redo && us.isArray(this._data.redo) && this._data.redo.length > 0,
  );
};

response.prototype.undo = function () {
  var ret = [];
  if (this._data && this._data.undo && us.isArray(this._data.undo)) {
    ret = this._data.undo;
  }
  return ret;
};

response.prototype.redo = function () {
  var ret = [];
  if (this._data && this._data.redo && us.isArray(this._data.redo)) {
    ret = this._data.redo;
  }
  return ret;
};

response.prototype.facts = function () {
  var ret = [];
  if (this._data && this._data.facts && us.isArray(this._data.facts)) {
    ret = this._data.facts;
  }
  return ret;
};

response.prototype.data_properties = function () {
  var ret = [];
  if (this._data && this._data["data-properties"] && us.isArray(this._data["data-properties"])) {
    ret = this._data["data-properties"];
  }
  return ret;
};

response.prototype.properties = function () {
  var ret = [];
  if (this._data && this._data.properties && us.isArray(this._data.properties)) {
    ret = this._data.properties;
  }
  return ret;
};

response.prototype.validation = function () {
  var ret = null;
  if (
    this._data &&
    this._data["validation-results"] &&
    us.isObject(this._data["validation-results"])
  ) {
    ret = bbop.clone(this._data["validation-results"]);
  }
  return ret;
};

response.prototype.valid_p = function () {
  var ret = true;
  var vres = this.validation();
  if (vres && us.isObject(vres) && us.isBoolean(vres["is-conformant"])) {
    ret = vres["is-conformant"];
  }
  return ret;
};

response.prototype.valid_owl_p = function () {
  var ret = true;
  var vres = this.validation();
  if (
    vres &&
    us.isObject(vres) &&
    vres["owl-validation"] &&
    us.isObject(vres["owl-validation"]) &&
    us.isBoolean(vres["owl-validation"]["is-conformant"])
  ) {
    ret = vres["owl-validation"]["is-conformant"];
  }
  return ret;
};

response.prototype.valid_shex_p = function () {
  var ret = true;
  var vres = this.validation();
  if (
    vres &&
    us.isObject(vres) &&
    vres["shex-validation"] &&
    us.isObject(vres["shex-validation"]) &&
    us.isBoolean(vres["shex-validation"]["is-conformant"])
  ) {
    ret = vres["shex-validation"]["is-conformant"];
  }
  return ret;
};

response.prototype.shex_violations = function () {
  var ret = [];
  var vres = this.validation();
  if (
    vres &&
    us.isObject(vres) &&
    vres["shex-validation"] &&
    us.isObject(vres["shex-validation"]) &&
    us.isArray(vres["shex-validation"].violations)
  ) {
    ret = bbop.clone(vres["shex-validation"].violations);
  }
  return ret;
};

response.prototype.individuals = function () {
  var ret = [];
  if (this._data && this._data.individuals && us.isArray(this._data.individuals)) {
    ret = this._data.individuals;
  }
  return ret;
};

response.prototype.inferred_individuals = function () {
  var ret = [];
  if (this._data && this._data["individuals-i"] && us.isArray(this._data["individuals-i"])) {
    ret = this._data["individuals-i"];
  }
  return ret;
};

response.prototype.annotations = function () {
  var ret = [];
  if (this._data && this._data.annotations && us.isArray(this._data.annotations)) {
    ret = this._data.annotations;
  }
  return ret;
};

response.prototype.export_model = function () {
  var ret = "";
  if (this._data && this._data["export-model"]) {
    ret = this._data["export-model"];
  }
  return ret;
};

response.prototype.relations = function () {
  var ret = [];
  if (
    this._data &&
    this._data.meta &&
    this._data.meta.relations &&
    us.isArray(this._data.meta.relations)
  ) {
    ret = this._data.meta.relations;
  }
  return ret;
};

response.prototype.evidence = function () {
  var ret = [];
  if (
    this._data &&
    this._data.meta &&
    this._data.meta.evidence &&
    us.isArray(this._data.meta.evidence)
  ) {
    ret = this._data.meta.evidence;
  }
  return ret;
};

response.prototype.model_ids = function () {
  var ret = [];
  if (
    this._data &&
    this._data.meta &&
    this._data.meta["models-meta"] &&
    us.isObject(this._data.meta["models-meta"])
  ) {
    ret = us.keys(this._data.meta["models-meta"]);
  }
  return ret;
};

response.prototype.models_meta = function () {
  var ret = {};
  if (
    this._data &&
    this._data.meta &&
    this._data.meta["models-meta"] &&
    us.isObject(this._data.meta["models-meta"])
  ) {
    ret = this._data.meta["models-meta"];
  }
  return ret;
};

response.prototype.models_meta_read_only = function () {
  var ret = {};
  if (
    this._data &&
    this._data.meta &&
    this._data.meta["models-meta-read-only"] &&
    us.isObject(this._data.meta["models-meta-read-only"])
  ) {
    ret = this._data.meta["models-meta-read-only"];
  }
  return ret;
};

export default response;
