import bbop from "bbop-core";
import registry from "bbop-registry";
import us from "underscore";

var each = us.each;

function isSameShallow(a, b) {
  if (a === b) {
    return true;
  }
  if (!a || !b || bbop.what_is(a) !== bbop.what_is(b)) {
    return false;
  }
  if (bbop.what_is(a) === "array") {
    if (a.length !== b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
  }
  if (bbop.what_is(a) === "object") {
    var aKeys = Object.keys(a);
    var bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (var j = 0; j < aKeys.length; j++) {
      var key = aKeys[j];
      if (a[key] !== b[key]) {
        return false;
      }
    }
    return true;
  }
  return false;
}

var manager = function (golr_loc, golr_conf_obj, engine, mode) {
  registry.call(this, ["prerun", "reset", "search", "error", "postrun"]);
  this._is_a = "bbop-manager-golr";
  var anchor = this;

  this._logger = new bbop.logger(this._is_a);
  this._logger.DEBUG = false;
  function ll(str) {
    anchor._logger.kvetch(str);
  }

  anchor._engine = engine || null;
  anchor._mode = mode || null;
  anchor._runner = function (resource, payload) {
    var ret = null;
    if (anchor._mode === "sync") {
      ret = anchor._engine.fetch(resource, payload);
    } else if (anchor._mode === "async") {
      ret = anchor._engine.start(resource, payload);
    } else {
      return resource;
    }
    return ret;
  };

  anchor._run_reset_callbacks = function (response) {
    ll("run reset callbacks...");
    anchor.apply_callbacks("reset", [response, anchor]);
    anchor.apply_callbacks("postrun", [response, anchor]);
  };

  anchor._run_search_callbacks = function (response) {
    ll("run search callbacks...");
    anchor.apply_callbacks("search", [response, anchor]);
    anchor.apply_callbacks("postrun", [response, anchor]);
  };

  anchor._run_error_callbacks = function (response) {
    ll("run error callbacks...");
    anchor.apply_callbacks("error", [response, anchor]);
    anchor.apply_callbacks("postrun", [response, anchor]);
  };

  if (engine) {
    anchor.run_promise_functions = function (
      promise_function_stack,
      accumulator_function,
      final_function,
      error_function,
    ) {
      return engine.run_promise_functions(
        promise_function_stack,
        accumulator_function,
        final_function,
        error_function,
      );
    };

    anchor._engine.register("success", function (response) {
      if (!response.success()) {
        throw new Error("Unsuccessful response from golr server!");
      } else {
        var cb_type = response.callback_type();
        if (cb_type === "reset") {
          anchor._run_reset_callbacks(response);
        } else if (cb_type === "search") {
          anchor._run_search_callbacks(response);
        } else {
          throw new Error("Unknown callback type (runner): " + cb_type);
        }
      }
    });

    anchor._engine.register("error", function (response) {
      anchor._run_error_callbacks(response);
    });
  }

  var alphanum = new RegExp(/^[a-zA-Z0-9 ]+$/);
  this.minimal_query_length = 3;
  this.last_sent_packet = 0;

  if (!golr_loc || !golr_conf_obj) {
    ll("ERROR: no proper arguments");
  }
  if (typeof golr_loc !== "string") {
    ll("ERROR: no proper golr url string argument");
  }
  if (!golr_conf_obj._is_a || golr_conf_obj._is_a !== "golr-conf.conf") {
    ll("ERROR: no proper golr-conf.conf object argument");
    throw new Error("boink! " + bbop.what_is(golr_conf_obj));
  }

  this._safety = false;
  this._solr_url = golr_loc;
  this._golr_conf = golr_conf_obj;
  this._batch_urls = [];
  this._batch_accumulator_func = function () {};
  this._batch_final_func = function () {};
  this._excursions = [];
  this._current_class = null;

  this.fundamental_query = "*:*";
  this.default_query = "*:*";
  this.query = this.default_query;
  this.default_fl = "*,score";
  this.current_fl = this.default_fl;
  this.default_rows = 10;
  this.default_start = 0;
  this.current_rows = this.default_rows;
  this.current_start = this.default_start;
  this.default_facet_limit = 25;
  this.current_facet_limit = 25;
  this.current_facet_field_limits = {};
  this.current_facet_offset = 25;
  this.current_facet_field_offsets = {};
  this.default_hl_snippets = 1000;

  this.query_variants = {
    defType: "edismax",
    qt: "standard",
    indent: "on",
    wt: "json",
    rows: anchor.current_rows,
    start: anchor.current_start,
    fl: anchor.default_fl,
    facet: "true",
    "facet.mincount": 1,
    "facet.sort": "count",
    "json.nl": "arrarr",
    "facet.limit": anchor.default_facet_limit,
  };

  this.query_fields = {};
  this.query_filters = {};
  this.facet_fields = {};

  this.debug = function (p) {
    if (p === true || p === false) {
      this._logger.DEBUG = p;
    }
    return this._logger.DEBUG;
  };

  this.minimal_query = function (n) {
    if (us.isNumber(n)) {
      anchor.minimal_query_length = n;
    }
    return this.minimal_query_length;
  };

  this.lite = function (use_lite_p) {
    if (use_lite_p === true || use_lite_p === false) {
      if (use_lite_p === true) {
        var per = anchor.get_personality();
        if (per) {
          var field_collection = {};
          var ccl = anchor._current_class;

          each(["result"], function (cat) {
            field_collection = bbop.merge(field_collection, ccl.get_weights(cat));
          });

          var flist = us.keys(field_collection);
          each(flist.slice(), function (flist_item) {
            each(["_label"], function (field_suffix) {
              var new_field = flist_item + field_suffix;
              var nf_obj = ccl.get_field(new_field);
              if (nf_obj) {
                flist.push(new_field);
                if (nf_obj.is_multi()) {
                  flist.push(flist_item + "_map");
                }
              }
            });
          });

          flist.push("score");
          flist.push("id");
          anchor.current_fl = flist.join(",");
          anchor.set("fl", anchor.current_fl);
        }
      } else {
        anchor.current_fl = anchor.default_fl;
        anchor.set("fl", anchor.current_fl);
      }
    }

    return anchor.default_fl !== anchor.current_fl;
  };

  function _field_to_facet_field(field) {
    return "f." + field + ".facet.limit";
  }

  this.get_facet_limit = function (field) {
    var retval = null;
    if (!field) {
      retval = anchor.current_facet_limit;
    } else {
      var f = _field_to_facet_field(field);
      var try_val = anchor.current_facet_field_limits[f];
      if (typeof try_val !== "undefined") {
        retval = try_val;
      }
    }
    return retval;
  };

  this.set_facet_limit = function (arg1, arg2) {
    var retval = false;

    if (typeof arg2 === "undefined" && bbop.what_is(arg1) === "number") {
      anchor.current_facet_limit = arg1;
      anchor.set("facet.limit", anchor.current_facet_limit);
      retval = true;
    } else if (
      typeof arg1 !== "undefined" &&
      typeof arg2 !== "undefined" &&
      bbop.what_is(arg1) === "string" &&
      bbop.what_is(arg2) === "number"
    ) {
      var field = _field_to_facet_field(arg1);
      anchor.current_facet_field_limits[field] = arg2;
      retval = true;
    }

    return retval;
  };

  this.set_default_facet_limit = function (lim) {
    var retval = anchor.default_facet_limit;
    anchor.default_facet_limit = lim;
    return retval;
  };

  this.reset_facet_limit = function (field) {
    var retval = false;
    if (typeof field === "undefined") {
      anchor.current_facet_limit = anchor.default_facet_limit;
      anchor.set("facet.limit", anchor.current_facet_limit);
      anchor.current_facet_field_limits = {};
      retval = true;
    } else {
      var f = _field_to_facet_field(field);
      if (typeof anchor.current_facet_field_limits[f] !== "undefined") {
        delete anchor.current_facet_field_limits[f];
        retval = true;
      }
    }
    return retval;
  };

  this.get_results_count = function () {
    return anchor.get("rows");
  };

  this.set_results_count = function (count) {
    anchor.set("rows", count);
    anchor.current_rows = count;
    return anchor.current_rows;
  };

  this.reset_results_count = function () {
    anchor.set("rows", anchor.default_rows);
    anchor.current_rows = anchor.default_rows;
    return anchor.current_rows;
  };

  this.plist_to_property_hash = function (plist) {
    var phash = { negative_p: false, sticky_p: false };
    if (plist) {
      each(plist, function (item) {
        if (item === "+") {
          phash.negative_p = false;
        } else if (item === "-") {
          phash.negative_p = true;
        } else if (item === "*") {
          phash.sticky_p = true;
        } else if (item === "$") {
          phash.sticky_p = false;
        }
      });
    }
    return phash;
  };

  this.add_query_filter_as_string = function (filter_string, plist) {
    var f_v = bbop.first_split(":", filter_string);
    var fname = f_v[0];
    var fval = bbop.dequote(f_v[1]);
    var props = us.isArray(plist) ? plist : [];
    var ret = {};
    if (fname !== "" && fval !== "") {
      var lead_char = fname.charAt(0);
      if (lead_char === "-" || lead_char === "+") {
        props.push(lead_char);
        fname = fname.substr(1, fname.length - 1);
      }
      ret = this.add_query_filter(fname, fval, props);
    }
    return ret;
  };

  this.add_query_filter = function (filter, value, plist) {
    if (typeof this.query_filters[filter] === "undefined") {
      this.query_filters[filter] = {};
    }
    this.query_filters[filter][value] = this.plist_to_property_hash(plist);
    return {};
  };

  this.remove_query_filter = function (filter, value, plist) {
    var retval = false;

    function _full_delete(hash, key1, key2) {
      if (key1 && key2 && hash && hash[key1] && hash[key1][key2]) {
        delete hash[key1][key2];
      }
      if (us.isEmpty(hash[key1])) {
        delete hash[key1];
      }
    }

    if (filter && value && anchor.query_filters[filter] && anchor.query_filters[filter][value]) {
      if (!plist || us.isEmpty(plist)) {
        _full_delete(anchor.query_filters, filter, value);
        retval = true;
      } else {
        var filter_phash = anchor.query_filters[filter][value];
        var in_phash = anchor.plist_to_property_hash(plist);
        if (isSameShallow(filter_phash, in_phash)) {
          _full_delete(anchor.query_filters, filter, value);
          retval = true;
        }
      }
    }

    return retval;
  };

  this.reset_query_filters = function () {
    each(anchor.query_filters, function (values, filter) {
      each(values, function (props, value) {
        if (!props.sticky_p) {
          anchor.remove_query_filter(filter, value);
        }
      });
    });
    return {};
  };

  this.get_query_filter_properties = function (filter, value) {
    var retobj = null;
    var aqf = anchor.query_filters;
    if (filter && value && aqf[filter] && aqf[filter][value]) {
      retobj = {
        filter: filter,
        value: value,
        negative_p: aqf[filter][value].negative_p,
        sticky_p: aqf[filter][value].sticky_p,
      };
    }
    return retobj;
  };

  this.get_query_filters = function () {
    var retlist = [];
    each(anchor.query_filters, function (values, f) {
      each(values, function (_props, v) {
        retlist.push(anchor.get_query_filter_properties(f, v));
      });
    });
    return retlist;
  };

  this.get_sticky_query_filters = function () {
    var retlist = [];
    each(anchor.query_filters, function (values, f) {
      each(values, function (_props, v) {
        var qfp = anchor.get_query_filter_properties(f, v);
        if (qfp.sticky_p === true) {
          retlist.push(qfp);
        }
      });
    });
    return retlist;
  };

  this.filter_list_to_assemble_hash = function (flist) {
    var h = {};
    each(flist, function (filter_property) {
      var filter = filter_property.filter;
      var value = filter_property.value;
      if (filter_property.negative_p) {
        filter = "-" + filter;
      }
      if (typeof h[filter] === "undefined") {
        h[filter] = [];
      }
      h[filter].push(value);
    });
    return h;
  };

  this.sensible_query_p = function () {
    var retval = false;
    var q = anchor.get_query();
    var qf = anchor.query_field_set();

    if (qf && !us.isEmpty(qf)) {
      if (q === anchor.get_default_query()) {
        retval = true;
      } else if (q === anchor.get_fundamental_query()) {
        retval = true;
      } else if (q && q.length >= anchor.minimal_query_length) {
        retval = true;
      } else if (q === "") {
        retval = true;
      }
    }
    return retval;
  };

  this.last_packet_sent = function () {
    return anchor.last_sent_packet;
  };

  this.clear = function () {
    anchor.query = anchor.default_query;
    anchor.reset_query_filters();
  };

  this.reset = function () {
    return anchor.update("reset");
  };

  this.search = function () {
    return anchor.update("search");
  };

  this.page = function (rows, start) {
    anchor.set("rows", rows);
    anchor.set("start", start);
    return anchor.update("search", rows, start);
  };

  this.page_first = anchor.search;

  this.page_previous = function () {
    var do_rows = anchor.get_page_rows();
    var do_offset = anchor.get_page_start() - do_rows;
    return anchor.page(do_rows, do_offset);
  };

  this.page_next = function () {
    var do_rows = anchor.get_page_rows();
    var do_offset = anchor.get_page_start() + do_rows;
    return anchor.page(do_rows, do_offset);
  };

  this.page_last = function (total_document_count) {
    var do_rows = anchor.get_page_rows();
    var mod = total_document_count % do_rows;
    var do_offset = total_document_count - mod;
    if (mod === 0) {
      return anchor.page(do_rows, do_offset - do_rows);
    }
    return anchor.page(do_rows, do_offset);
  };

  this.get_page_rows = function () {
    return anchor.get("rows");
  };

  this.get_page_start = function () {
    return anchor.get("start");
  };

  this.add_query_field = function (qf, boost) {
    var retval = false;
    if (typeof boost === "undefined") {
      boost = 1.0;
    }
    if (typeof anchor.query_fields[qf] === "undefined") {
      retval = true;
    }
    anchor.query_fields[qf] = boost;
    return retval;
  };

  this.query_field_set = function (qfs) {
    var cclass = anchor._current_class;

    if (qfs) {
      if (cclass) {
        var searchable_qfs = {};
        each(qfs, function (value, filter) {
          var cfield = cclass.get_field(filter);
          if (cfield && cfield.searchable()) {
            searchable_qfs[filter + "_searchable"] = value;
          } else {
            searchable_qfs[filter] = value;
          }
        });
        qfs = searchable_qfs;
      }
      anchor.query_fields = qfs;
    }

    var output_format = [];
    each(anchor.query_fields, function (value, filter) {
      output_format.push(filter + "^" + value);
    });
    return output_format;
  };

  this.facets = function (list_or_key) {
    if (list_or_key) {
      if (bbop.what_is(list_or_key) !== "array") {
        list_or_key = [list_or_key];
      } else {
        anchor.facet_fields = {};
      }
      each(list_or_key, function (item) {
        anchor.facet_fields[item] = true;
      });
    }
    return us.keys(anchor.facet_fields);
  };

  this.set_default_query = function (new_default_query) {
    anchor.default_query = new_default_query;
    return anchor.default_query;
  };

  this.reset_default_query = function () {
    anchor.default_query = anchor.fundamental_query;
    return anchor.default_query;
  };

  this.set_query = function (new_query) {
    anchor.query = new_query;
    return anchor.query;
  };

  this.set_comfy_query = function (new_query) {
    var comfy_query = new_query;
    if (new_query && new_query.length && new_query.length > 0) {
      var has_cursor_p = true;
      if (new_query.slice(-1) === " ") {
        has_cursor_p = false;
      }
      new_query = bbop.chomp(new_query);
      if (new_query && new_query.length && new_query.length > 0) {
        if (alphanum.test(new_query) && has_cursor_p) {
          var tokens = new_query.split(new RegExp("\\s+"));
          var last_token = tokens[tokens.length - 1];
          if (tokens.length === 1) {
            if (last_token.length >= anchor.minimal_query_length) {
              tokens[tokens.length - 1] = last_token + "*";
            }
          } else {
            tokens[tokens.length - 1] = last_token + "*";
          }
          comfy_query = tokens.join(" ");
        }
      }
    }
    return anchor.set_query(comfy_query);
  };

  this.set_id = function (new_id) {
    anchor.query = "id:" + bbop.ensure(new_id, '"');
    return anchor.query;
  };

  function _lock_map(field, id_list) {
    var fixed_list = [];
    each(id_list, function (item) {
      fixed_list.push(bbop.ensure(item, '"'));
    });
    return field + ":(" + fixed_list.join(" OR ") + ")";
  }

  this.set_ids = function (id_list) {
    anchor.query = _lock_map("id", id_list);
    return anchor.query;
  };

  this.set_targets = function (id_list, field_list) {
    var fixed_list = [];
    each(field_list, function (field) {
      fixed_list.push(_lock_map(field, id_list));
    });
    anchor.query = fixed_list.join(" OR ");
    return anchor.query;
  };

  this.get_query = function () {
    return anchor.query;
  };

  this.get_default_query = function () {
    return anchor.default_query;
  };

  this.get_fundamental_query = function () {
    return anchor.fundamental_query;
  };

  this.reset_query = function () {
    anchor.query = anchor.default_query;
    ll("reset query to default: " + anchor.query);
    return anchor.query;
  };

  this.query_extra = null;
  this.set_extra = function (new_extra) {
    anchor.query_extra = new_extra;
    return anchor.query_extra;
  };
  this.get_extra = anchor.set_extra;
  this.remove_extra = function () {
    anchor.query_extra = "";
    return anchor.query_extra;
  };

  this.set = function (key, new_val) {
    anchor.query_variants[key] = new_val;
  };

  this.get = function (key) {
    return anchor.query_variants[key];
  };

  this.unset = function (key) {
    var retval = false;
    if (typeof anchor.query_variants[key] !== "undefined") {
      retval = true;
      delete anchor.query_variants[key];
    }
    return retval;
  };

  this.include_highlighting = function (hilite_p, html_elt_str) {
    var retval = false;
    if (typeof hilite_p !== "undefined" && (hilite_p === true || hilite_p === false)) {
      if (hilite_p === true) {
        if (!html_elt_str) {
          html_elt_str = '<em class="hilite">';
        }
        anchor.set("hl", "true");
        anchor.set("hl.simple.pre", html_elt_str);
        anchor.set("hl.snippets", anchor.default_hl_snippets);
        retval = html_elt_str;
      } else {
        anchor.unset("hl");
        anchor.unset("hl.simple.pre");
        anchor.unset("hl.snippets");
      }
    } else {
      var cl_tmp = anchor.get("hl.simple.pre");
      if (typeof cl_tmp !== "undefined") {
        retval = cl_tmp;
      }
    }
    return retval;
  };

  this.set_personality = function (personality_id) {
    var retval = false;
    var cclass = anchor._golr_conf.get_class(personality_id);
    if (cclass) {
      this._current_class = cclass;
      anchor.facets(cclass.field_order_by_weight("filter"));
      anchor.query_field_set(cclass.get_weights("boost"));
      retval = true;
    }
    return retval;
  };

  this.get_personality = function () {
    var retval = null;
    if (
      typeof anchor._current_class !== "undefined" &&
      bbop.what_is(anchor._current_class) === "golr-conf.conf_class"
    ) {
      retval = anchor._current_class.id();
    }
    return retval;
  };

  this.get_query_url = function () {
    var qurl = anchor._solr_url + "select?";
    var fq = anchor.filter_list_to_assemble_hash(anchor.get_query_filters());
    var things_to_add = [
      bbop.get_assemble(anchor.query_variants),
      bbop.get_assemble(anchor.current_facet_field_limits),
      bbop.get_assemble({ fq: fq }),
      bbop.get_assemble({ "facet.field": us.keys(anchor.facet_fields) }),
      bbop.get_assemble({ q: anchor.query }),
      anchor.query_extra,
    ];
    if (
      anchor.query &&
      anchor.query.length &&
      anchor.query.length !== 0 &&
      anchor.query !== anchor.fundamental_query
    ) {
      things_to_add.push(bbop.get_assemble({ qf: anchor.query_field_set() }));
    }

    var filtered_things = bbop.pare(things_to_add, function (item) {
      return !(item && item !== "");
    });
    var final_qurl = qurl + filtered_things.join("&");
    ll("qurl: " + final_qurl);
    return final_qurl;
  };

  this.push_excursion = function () {
    var now = {
      data_url: anchor.get_query_url(),
      session: {
        sticky_filters: anchor.get_sticky_query_filters(),
      },
    };
    anchor._excursions.push(now);
    return anchor._excursions.length;
  };

  this.pop_excursion = function () {
    var retval = false;
    var then = anchor._excursions.pop();
    if (then) {
      retval = true;
      anchor.load_url(then.data_url);
      each(then.session.sticky_filters, function (sticky) {
        var fpl = [];
        if (sticky.negative_p === true) {
          fpl.push("-");
        }
        if (sticky.sticky_p === true) {
          fpl.push("*");
        }
        anchor.add_query_filter(sticky.filter, sticky.value, fpl);
      });
    }
    return retval;
  };

  this.get_download_url = function (field_list, in_arg_hash) {
    anchor.push_excursion();
    var arg_hash = bbop.fold(
      {
        rows: 1000,
        encapsulator: "",
        separator: "\t",
        header: "false",
        mv_separator: "|",
        entity_list: [],
        golr_download_url: null,
      },
      in_arg_hash,
    );

    anchor.set("wt", "csv");
    anchor.set("start", 0);
    anchor.set("fl", field_list.join(","));
    anchor.set("rows", arg_hash.rows);
    anchor.set("csv.encapsulator", arg_hash.encapsulator);
    anchor.set("csv.separator", arg_hash.separator);
    anchor.set("csv.header", arg_hash.header);
    anchor.set("csv.mv.separator", arg_hash.mv_separator);

    if (
      typeof arg_hash.entity_list !== "undefined" &&
      us.isArray(arg_hash.entity_list) &&
      arg_hash.entity_list.length > 0
    ) {
      anchor.set_ids(arg_hash.entity_list);
    }

    var returl = anchor.get_query_url();
    if (arg_hash.golr_download_url) {
      returl = returl.replace(anchor._solr_url, arg_hash.golr_download_url);
    }

    anchor.pop_excursion();
    return returl;
  };

  this.get_filter_query_string = function () {
    var q = anchor.get_query();
    var filters = anchor.get_query_filters();
    var std_filters = [];
    var sticky_filters = [];
    each(filters, function (filter) {
      if (filter.sticky_p) {
        sticky_filters.push(filter);
      } else {
        std_filters.push(filter);
      }
    });

    var fq = anchor.filter_list_to_assemble_hash(std_filters);
    var sfq = anchor.filter_list_to_assemble_hash(sticky_filters);
    var things_to_add = [];
    if (q) {
      things_to_add.push(bbop.get_assemble({ q: q }));
    }
    if (!us.isEmpty(fq)) {
      things_to_add.push(bbop.get_assemble({ fq: fq }));
    }
    if (!us.isEmpty(sfq)) {
      things_to_add.push(bbop.get_assemble({ sfq: sfq }));
    }
    return things_to_add.join("&");
  };

  this.get_state_url = function () {
    anchor.push_excursion();
    anchor.set("personality", anchor.get_personality());
    anchor.set("sfq", anchor.filter_list_to_assemble_hash(anchor.get_sticky_query_filters()));
    var returl = anchor.get_query_url();
    anchor.pop_excursion();
    return returl;
  };

  this.load_url = function (url) {
    var decoded_url = decodeURI(url);
    var in_params = us.map(bbop.url_parameters(decoded_url), function (param_pair) {
      return us.map(param_pair, function (param_component) {
        return decodeURIComponent(param_component);
      });
    });

    var seen_params = {};
    each(in_params, function (ip) {
      var key = ip[0];
      var val = ip[1];
      if (key === "personality" && val && val !== "") {
        anchor.set_personality(val);
      }
      seen_params[key] = true;
    });

    var sticky_cache = {};
    each(in_params, function (ip) {
      var key = ip[0];
      var val = ip[1];
      if (typeof val !== "undefined" && val !== "") {
        if (key === "personality") {
        } else if (key === "q") {
          anchor.set_query(val);
        } else if (key === "fq" || key === "sfq") {
          var fnv = bbop.first_split(":", val);
          var fname = fnv[0];
          var fval = fnv[1];
          if (fname && fval) {
            var plist = [];
            var lead_char = fname.charAt(0);
            if (lead_char === "-" || lead_char === "+") {
              plist.push(lead_char);
              fname = fname.substr(1, fname.length - 1);
            }
            fval = bbop.dequote(fval);
            var skey = fname + "^" + fval;
            if (key === "sfq") {
              sticky_cache[skey] = true;
              plist.push("*");
            }
            if (!bbop.is_defined(sticky_cache[skey]) || key === "sfq") {
              anchor.add_query_filter(fname, fval, plist);
            }
          }
        } else if (key === "qf") {
          var foo = bbop.first_split("^", val);
          anchor.add_query_field(foo[0], foo[1]);
        } else if (key === "facet.field") {
          anchor.facets(val);
        } else if (key === "start" || key === "rows") {
          if (bbop.what_is(val) === "string") {
            val = parseFloat(val);
          }
          anchor.set(key, val);
        } else {
          anchor.set(key, val);
        }
      }
    });

    each(anchor.query_variants, function (_val, key) {
      if (typeof seen_params[key] === "undefined") {
        anchor.unset(key);
      }
    });

    var curr_url = anchor.get_query_url();
    var curr_params = bbop.url_parameters(curr_url);
    var differences = 0;
    if (in_params.length === curr_params.length) {
      each(in_params, function (in_p, i) {
        var curr_p = curr_params[i];
        if (in_p.length === curr_p.length) {
          if (in_p.length === 1) {
            if (in_p[0] !== curr_p[0]) {
              differences++;
            }
          } else if (in_p.length === 2) {
            if (in_p[0] !== curr_p[0] || in_p[1] !== curr_p[1]) {
              differences++;
            }
          }
        } else {
          differences++;
        }
      });
    } else {
      differences++;
    }

    return differences === 0;
  };

  this.add_to_batch = function () {
    var qurl = anchor.get_query_url();
    anchor._batch_urls.push(qurl);
    return qurl;
  };

  this.batch_urls = function () {
    return anchor._batch_urls;
  };

  this.next_batch_url = function () {
    return anchor._batch_urls.shift() || null;
  };

  this.reset_batch = function () {
    var num = anchor._batch_urls.length;
    anchor._batch_urls = [];
    return num;
  };
};
bbop.extend(manager, registry);

manager.prototype.to_string = function () {
  return "<" + this._is_a + ">";
};

manager.prototype.update = function (callback_type, rows, start) {
  var anchor = this;
  if (typeof rows === "undefined" || typeof start === "undefined") {
    this.set("rows", this.current_rows);
    this.set("start", this.current_start);
  }

  this.last_sent_packet = this.last_sent_packet + 1;
  var update_qv = bbop.get_assemble({
    packet: this.last_sent_packet,
    callback_type: callback_type,
  });

  var qurl = null;
  if (callback_type === "reset") {
    this.reset_query();
    this.reset_query_filters();
    qurl = this.get_query_url() + "&" + update_qv;
  } else if (callback_type === "search") {
    qurl = this.get_query_url() + "&" + update_qv;
  } else {
    throw new Error("Unknown callback_type (in update): " + callback_type);
  }

  this.apply_callbacks("prerun", [anchor]);
  return anchor._runner(qurl);
};

export default manager;
