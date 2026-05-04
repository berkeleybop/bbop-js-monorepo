/*
 * Generic BBOP handler for dealing with the gross parsing of
 * responses from a GOlr server.
 */

import bbop from "bbop-core";
import us from "underscore";
import bbopRestResponse from "bbop-rest-response";

var response = function (json_data) {
  bbopRestResponse.json.call(this, json_data);
  this._is_a = "bbop-response-golr";

  this._success = null;
  this._doc_id2index = null;
  this._doc_index2id = null;
  this._doc_label_maps = {};
  this._hl_regexp = new RegExp("<[^>]*>", "g");
};
bbop.extend(response, bbopRestResponse.json);

response.prototype.raw = function () {
  return this._raw;
};

response.prototype.success = function () {
  if (this._success === null) {
    var robj = this._raw;
    if (
      robj &&
      robj.responseHeader &&
      typeof robj.responseHeader.status !== "undefined" &&
      robj.responseHeader.status === 0 &&
      robj.responseHeader.params &&
      robj.response &&
      typeof robj.response.numFound !== "undefined" &&
      typeof robj.response.start !== "undefined" &&
      typeof robj.response.maxScore !== "undefined" &&
      robj.response.docs &&
      robj.facet_counts &&
      robj.facet_counts.facet_fields
    ) {
      this._success = true;
    } else {
      this._success = false;
    }
  }

  return this._success;
};

response.prototype.okay = function () {
  return this.success();
};

response.prototype.callback_type = function () {
  var retval = null;
  if (
    this._raw.responseHeader.params.callback_type &&
    typeof this._raw.responseHeader.params.callback_type !== "undefined"
  ) {
    retval = this._raw.responseHeader.params.callback_type;
  }
  return retval;
};

response.prototype.parameters = function () {
  return this._raw.responseHeader.params;
};

response.prototype.parameter = function (key) {
  var retval = null;
  if (this._raw.responseHeader.params[key] && this._raw.responseHeader.params[key]) {
    retval = this._raw.responseHeader.params[key];
  }
  return retval;
};

response.prototype.row_step = function () {
  return parseInt(this._raw.responseHeader.params.rows);
};

response.prototype.total_documents = function () {
  return parseInt(this._raw.response.numFound);
};

response.prototype.start_document = function () {
  return parseInt(this._raw.response.start) + 1;
};

response.prototype.end_document = function () {
  return this.start_document() + parseInt(this._raw.response.docs.length) - 1;
};

response.prototype.packet = function () {
  var retval = null;
  var pval = this._raw.responseHeader.params.packet;
  if (pval) {
    retval = parseInt(pval);
  }
  return retval;
};

response.prototype.paging_p = function () {
  return this.total_documents() > this.row_step();
};

response.prototype.paging_previous_p = function () {
  return this.start_document() > 1;
};

response.prototype.paging_next_p = function () {
  return this.total_documents() > this.end_document();
};

response.prototype.documents = function () {
  return this._raw.response.docs;
};

response.prototype.highlighted_documents = function () {
  var zipped = us.zip(this._raw.response.docs, us.values(this._raw.highlighting));
  return us.map(zipped, function (tuple) {
    var json = tuple[0];
    var highlight = tuple[1];

    return us.mapObject(json, function (val, key) {
      if (highlight[key] != null) {
        return highlight[key];
      }
      return val;
    });
  });
};

response.prototype.get_doc = function (doc_id) {
  var doc = null;
  var docs = this._raw.response.docs;
  if (docs && docs[doc_id]) {
    doc = docs[doc_id];
  } else {
    var local_anchor = this;
    if (!this._doc_id2index) {
      this._doc_id2index = {};
      this._doc_index2id = {};
      us.each(docs, function (doc_item, doc_index) {
        var did = doc_item.id;
        local_anchor._doc_id2index[did] = doc_index;
        local_anchor._doc_index2id[doc_index] = did;
      });
    }

    if (this._doc_id2index && typeof this._doc_id2index[doc_id] !== "undefined") {
      var doc_i = this._doc_id2index[doc_id];
      doc = docs[doc_i];
    }
  }

  return doc;
};

response.prototype.get_doc_field = function (doc_id, field_id) {
  var ret = null;
  var doc = this.get_doc(doc_id);
  if (doc && typeof doc[field_id] !== "undefined") {
    ret = doc[field_id];
  }
  return ret;
};

response.prototype.get_doc_label = function (doc_id, field_id, item_id) {
  var retval = null;
  var anchor = this;
  var doc = this.get_doc(doc_id);
  if (doc && typeof doc[field_id] !== "undefined") {
    var ilabel = this.get_doc_field(doc_id, `${field_id}_label`);

    if (ilabel && bbop.what_is(ilabel) === "string") {
      retval = ilabel;
    } else if (ilabel && bbop.what_is(ilabel) === "array") {
      var iid = this.get_doc_field(doc_id, field_id);
      if (ilabel.length === 1 && iid && bbop.what_is(iid) === "array" && iid.length === 1) {
        retval = ilabel[0];
      } else {
        var _map_to_try = function (doc_key, map_field, item_key) {
          var retlbl = null;
          var map_str = anchor.get_doc_field(doc_key, map_field);

          if (map_str && bbop.what_is(map_str) === "string") {
            if (typeof anchor._doc_label_maps[doc_key] === "undefined") {
              anchor._doc_label_maps[doc_key] = {};
            }
            if (typeof anchor._doc_label_maps[doc_key][map_field] === "undefined") {
              anchor._doc_label_maps[doc_key][map_field] = JSON.parse(map_str);
            }

            var map = anchor._doc_label_maps[doc_key][map_field];
            if (map && map[item_key]) {
              retlbl = map[item_key];
            }
          }

          return retlbl;
        };

        var mlabel = _map_to_try(doc_id, `${field_id}_map`, item_id);
        if (mlabel) {
          retval = mlabel;
        } else {
          var cmlabel = _map_to_try(doc_id, `${field_id}_closure_map`, item_id);
          if (cmlabel) {
            retval = cmlabel;
          } else {
            var lmlabel = _map_to_try(doc_id, `${field_id}_list_map`, item_id);
            if (lmlabel) {
              retval = lmlabel;
            }
          }
        }
      }
    }
  }

  return retval;
};

response.prototype.get_doc_highlight = function (doc_id, field_id, item) {
  var ret = null;
  var hilite_obj = null;

  if (this._raw.highlighting && this._raw.highlighting[doc_id]) {
    hilite_obj = this._raw.highlighting[doc_id];
  } else {
    var iid = this._doc_index2id && this._doc_index2id[doc_id];
    if (iid) {
      var new_doc = this.get_doc(iid);
      var new_doc_id = new_doc.id;
      if (this._raw.highlighting && this._raw.highlighting[new_doc_id]) {
        hilite_obj = this._raw.highlighting[new_doc_id];
      }
    }
  }

  if (hilite_obj) {
    var ans = null;

    if (hilite_obj[`${field_id}_label_searchable`]) {
      ans = hilite_obj[`${field_id}_label_searchable`];
    }
    if (!ans && hilite_obj[`${field_id}_label`]) {
      ans = hilite_obj[`${field_id}_label`];
    }
    if (!ans && hilite_obj[`${field_id}_searchable`]) {
      ans = hilite_obj[`${field_id}_searchable`];
    }
    if (!ans && hilite_obj[field_id]) {
      ans = hilite_obj[field_id];
    }

    if (ans) {
      var matches_p = false;
      us.each(
        ans,
        function (an) {
          if (!matches_p) {
            var stripped = an.replace(this._hl_regexp, "");
            if (item === stripped) {
              matches_p = true;
              ret = an;
            }
          }
        },
        this,
      );
    }
  }

  return ret;
};

response.prototype.facet_field_list = function () {
  return us.keys(this._raw.facet_counts.facet_fields).sort();
};

response.prototype.facet_field = function (facet_name) {
  return this._raw.facet_counts.facet_fields[facet_name];
};

response.prototype.facet_counts = function () {
  var ret_hash = {};
  var anchor = this;
  us.each(this.facet_field_list(), function (ffield) {
    if (!ret_hash[ffield]) {
      ret_hash[ffield] = {};
    }

    us.each(anchor.facet_field(ffield), function (item) {
      var name = item[0];
      var count = item[1];
      ret_hash[ffield][name] = count;
    });
  });
  return ret_hash;
};

response.prototype.query = function () {
  var retval = null;
  if (this._raw.responseHeader.params && this._raw.responseHeader.params.q) {
    retval = this._raw.responseHeader.params.q;
  }
  return retval;
};

response.prototype.query_filters = function () {
  var ret_hash = {};
  var fq_list = this.parameter("fq");
  if (fq_list) {
    if (bbop.what_is(fq_list) === "string") {
      fq_list = [fq_list];
    }

    us.each(fq_list, function (fq_item) {
      var splits = fq_item.split(":");
      var field = splits.shift();
      var value = splits.join(":");
      var polarity = true;

      if (field.charAt(0) === "-") {
        polarity = false;
        field = field.substring(1, field.length);
      } else if (field.charAt(0) === "+") {
        field = field.substring(1, field.length);
      }

      if (!ret_hash[field]) {
        ret_hash[field] = {};
      }

      if (value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }

      ret_hash[field][value] = polarity;
    });
  }

  return ret_hash;
};

export default response;
