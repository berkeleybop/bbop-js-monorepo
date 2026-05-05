import bbop from "bbop-core";
import us from "underscore";

var bbop_logger = bbop.logger;
var each = us.each;

var conf_field = function (field_conf_struct) {
  this._is_a = "golr-conf.conf_field";
  this._field = field_conf_struct;

  var logger = new bbop_logger(this._is_a);
  logger.DEBUG = true;

  this.display_name = function () {
    return this._field.display_name;
  };

  this.description = function () {
    return this._field.description;
  };

  this.id = function () {
    return this._field.id;
  };

  this.searchable = function () {
    var retval = false;
    if (this._field.searchable === "true" || this._field.searchable === true) {
      retval = true;
    }
    return retval;
  };

  this.required = function () {
    var retval = false;
    if (this._field.required === "true" || this._field.required === true) {
      retval = true;
    }
    return retval;
  };

  this.is_multi = function () {
    var retval = false;
    if (this._field.cardinality === "multi") {
      retval = true;
    }
    return retval;
  };

  this.is_fixed = function () {
    var retval = false;
    if (this._field.property_type === "fixed") {
      retval = true;
    }
    return retval;
  };

  this.property = function () {
    var retval = "???";
    if (this._field.property) {
      retval = this._field.property;
    }
    return retval;
  };
};

var conf_class = function (class_conf_struct) {
  this._is_a = "golr-conf.conf_class";

  var logger = new bbop_logger(this._is_a);
  logger.DEBUG = true;

  this._class = class_conf_struct;

  this.display_name = function () {
    return this._class.display_name;
  };

  this.description = function () {
    return this._class.description;
  };

  this.weight = function () {
    return parseInt(this._class.weight) || 0;
  };

  this.id = function () {
    return this._class.id;
  };

  this.document_category = function () {
    return this._class.document_category || this.id();
  };

  this.searchable_extension = function () {
    return "_searchable";
  };

  this.get_field = function (fid) {
    var retval = null;
    if (this._class.fields_hash && this._class.fields_hash[fid]) {
      retval = new conf_field(this._class.fields_hash[fid]);
    }
    return retval;
  };

  this.get_fields = function () {
    var retval = [];
    if (this._class.fields_hash) {
      each(this._class.fields_hash, function (struct) {
        retval.push(new conf_field(struct));
      });
    }
    return retval;
  };

  this._munge_weight_category = function (weight_category) {
    if (!weight_category) {
      throw new Error("Missing weight category");
    } else if (
      weight_category !== "boost" &&
      weight_category !== "result" &&
      weight_category !== "filter"
    ) {
      throw new Error("Unknown weight category: " + weight_category);
    }

    return weight_category + "_weights";
  };

  this.get_weights = function (weight_category) {
    var rethash = {};
    weight_category = this._munge_weight_category(weight_category);

    if (typeof this._class[weight_category] === "undefined") {
      throw new Error("Missing weight category: " + weight_category);
    } else {
      var wcs = this._class[weight_category];
      if (wcs && wcs !== "" && wcs !== " ") {
        each(wcs.split(/\s+/), function (item) {
          var field_val = item.split(/\^/);
          rethash[field_val[0]] = parseFloat(field_val[1]);
        });
      }
    }

    return rethash;
  };

  this.field_order_by_weight = function (weight_category, cutoff) {
    var retset = [];
    var weights = this.get_weights(weight_category);

    each(weights, function (val, key) {
      if (cutoff) {
        if (val >= cutoff) {
          retset.push(key);
        }
      } else {
        retset.push(key);
      }
    });

    retset.sort(function (a, b) {
      return weights[b] - weights[a];
    });

    return retset;
  };
};

var conf = function (golr_conf_var) {
  this._is_a = "golr-conf.conf";

  var anchor = this;
  var logger = new bbop_logger(this._is_a);
  logger.DEBUG = true;
  function ll(str) {
    logger.kvetch(str);
  }

  if (!golr_conf_var || typeof golr_conf_var !== "object") {
    ll("ERROR: no proper golr conf var argument");
  }

  this._golr_conf = golr_conf_var;
  this._classes = {};
  each(anchor._golr_conf, function (val) {
    var newAsp = new conf_class(val);
    anchor._classes[newAsp.id()] = newAsp;
  });

  this.get_class = function (fid) {
    var retval = null;
    if (this._classes && this._classes[fid]) {
      retval = this._classes[fid];
    }
    return retval;
  };

  this.get_classes = function () {
    var ret = [];
    each(anchor._classes, function (val) {
      ret.push(val);
    });
    return ret;
  };

  this.get_classes_by_weight = function () {
    var ret = this.get_classes();
    ret.sort(function (cc1, cc2) {
      var w1 = cc1.weight() || 0;
      var w2 = cc2.weight() || 0;
      return w2 - w1;
    });
    return ret;
  };
};

export default {
  conf_field: conf_field,
  conf_class: conf_class,
  conf: conf,
};
