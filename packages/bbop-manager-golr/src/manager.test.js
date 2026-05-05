import { describe, it } from "node:test";
import { assert } from "chai";
import golrConf from "golr-conf";

import golrManager from "./manager.js";
import golrConfigFixture from "./fixtures/golr-config.js";

function sameArray(one, two) {
  if (one.length !== two.length) {
    return false;
  }
  for (var i = 0; i < one.length; i++) {
    if (one[i] !== two[i]) {
      return false;
    }
  }
  return true;
}

function linkComp(str1, str2) {
  var tmp1 = str1.split("?");
  var head1 = "";
  var args1 = [];
  if (!tmp1[1]) {
    args1 = tmp1[0].split("&");
  } else {
    head1 = tmp1[0];
    args1 = tmp1[1].split("&");
  }
  var sortedArgs1 = args1.sort();

  var tmp2 = str2.split("?");
  var head2 = "";
  var args2 = [];
  if (!tmp2[1]) {
    args2 = tmp2[0].split("&");
  } else {
    head2 = tmp2[0];
    args2 = tmp2[1].split("&");
  }
  var sortedArgs2 = args2.sort();

  return head1 === head2 && sameArray(sortedArgs1, sortedArgs2);
}

function makeConfig() {
  return new golrConf.conf(golrConfigFixture);
}

describe("bbop-manager-golr basics", function () {
  it("constructs and manages extra query state", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    assert.equal(gm._is_a, "bbop-manager-golr");
    assert.equal(gm.get("rows"), 10);
    gm.set("rows", 100);
    assert.equal(gm.get("rows"), 100);

    var bits = "fq=-isa_partof_closure:[* TO *]";
    var url1 = gm.get_query_url();
    gm.set_extra(bits);
    var url2 = gm.get_query_url();
    gm.set_extra("");
    var url3 = gm.get_query_url();

    assert.notEqual(url1, url2);
    assert.include(url2, url1);
    assert.include(url2, "&" + bits);
    assert.equal(url1, url3);
  });

  it("handles facets and personalities", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    assert.sameMembers(gm.facets(), []);
    gm.facets("foo");
    assert.sameMembers(gm.facets(), ["foo"]);
    assert.sameMembers(gm.facets("bar"), ["bar", "foo"]);

    gm.set_personality("annotation");
    assert.sameMembers(gm.facets(), [
      "source",
      "assigned_by",
      "aspect",
      "evidence_type_closure",
      "panther_family_label",
      "qualifier",
      "taxon_label",
      "annotation_class_label",
      "regulates_closure_label",
      "annotation_extension_class_closure_label",
    ]);

    gm.facets([]);
    assert.sameMembers(gm.facets(), []);
  });
});

describe("bbop-manager-golr query and filter behavior", function () {
  it("assembles complex annotation query urls", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_personality("annotation");
    gm.add_query_filter("document_category", "annotation", ["+", "*"]);
    gm.add_query_filter("document_category", "ontology_class", ["-"]);
    gm.add_query_filter("isa_partof_closure", "GO:0022008", ["+", "*"]);
    gm.set_extra("foo=bar");

    assert.equal(
      linkComp(
        gm.get_query_url(),
        [
          "http://golr.berkeleybop.org/select?defType=edismax",
          "qt=standard",
          "indent=on",
          "wt=json",
          "rows=10",
          "start=0",
          "fl=*%2Cscore",
          "facet=true",
          "facet.mincount=1",
          "facet.sort=count",
          "json.nl=arrarr",
          "facet.limit=25",
          "facet.field=source",
          "facet.field=assigned_by",
          "facet.field=aspect",
          "facet.field=evidence_type_closure",
          "facet.field=panther_family_label",
          "facet.field=qualifier",
          "facet.field=taxon_label",
          "facet.field=annotation_class_label",
          "facet.field=regulates_closure_label",
          "facet.field=annotation_extension_class_closure_label",
          "fq=document_category:%22annotation%22",
          "fq=-document_category:%22ontology_class%22",
          "fq=isa_partof_closure:%22GO%3A0022008%22",
          "q=*%3A*",
          "foo=bar",
        ].join("&"),
      ),
      true,
    );
  });

  it("tracks filter properties and sticky filter reset behavior", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.add_query_filter("foo1", "bar1a");
    gm.add_query_filter("foo1", "bar1b", ["+"]);
    gm.add_query_filter("foo2", "bar2", ["-"]);
    gm.add_query_filter("foo3", "bar3", ["+", "*"]);
    gm.add_query_filter("foo4", "bar4", ["-", "*"]);

    assert.sameDeepMembers(gm.get_query_filters(), [
      { filter: "foo1", value: "bar1a", negative_p: false, sticky_p: false },
      { filter: "foo1", value: "bar1b", negative_p: false, sticky_p: false },
      { filter: "foo2", value: "bar2", negative_p: true, sticky_p: false },
      { filter: "foo3", value: "bar3", negative_p: false, sticky_p: true },
      { filter: "foo4", value: "bar4", negative_p: true, sticky_p: true },
    ]);

    gm.remove_query_filter("foo1", "bar1a");
    gm.remove_query_filter("foo2", "bar2");
    assert.sameDeepMembers(gm.get_query_filters(), [
      { filter: "foo1", value: "bar1b", negative_p: false, sticky_p: false },
      { filter: "foo3", value: "bar3", negative_p: false, sticky_p: true },
      { filter: "foo4", value: "bar4", negative_p: true, sticky_p: true },
    ]);

    assert.sameDeepMembers(gm.get_sticky_query_filters(), [
      { filter: "foo3", value: "bar3", negative_p: false, sticky_p: true },
      { filter: "foo4", value: "bar4", negative_p: true, sticky_p: true },
    ]);

    gm.reset_query_filters();
    assert.sameDeepMembers(gm.get_query_filters(), [
      { filter: "foo3", value: "bar3", negative_p: false, sticky_p: true },
      { filter: "foo4", value: "bar4", negative_p: true, sticky_p: true },
    ]);

    assert.deepEqual(gm.get_query_filter_properties("foo4", "bar4"), {
      filter: "foo4",
      value: "bar4",
      negative_p: true,
      sticky_p: true,
    });
    assert.isNull(gm.get_query_filter_properties("foo5nope", "bar5nothinghere"));
  });

  it("converts property lists consistently", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    assert.deepEqual(gm.plist_to_property_hash(), { negative_p: false, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash([]), { negative_p: false, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash(["+"]), { negative_p: false, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash(["+", "$"]), { negative_p: false, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash(["$"]), { negative_p: false, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash(["-"]), { negative_p: true, sticky_p: false });
    assert.deepEqual(gm.plist_to_property_hash(["*"]), { negative_p: false, sticky_p: true });
    assert.deepEqual(gm.plist_to_property_hash(["-", "*"]), { negative_p: true, sticky_p: true });
  });
});

describe("bbop-manager-golr paging and query state", function () {
  it("updates paging urls and resets through search", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_personality("annotation");

    assert.equal(
      linkComp(
        gm.get_query_url(),
        [
          "http://golr.berkeleybop.org/select?defType=edismax",
          "qt=standard",
          "indent=on",
          "wt=json",
          "rows=10",
          "start=0",
          "fl=*%2Cscore",
          "facet=true",
          "facet.mincount=1",
          "facet.sort=count",
          "json.nl=arrarr",
          "facet.limit=25",
          "facet.field=source",
          "facet.field=assigned_by",
          "facet.field=aspect",
          "facet.field=evidence_type_closure",
          "facet.field=panther_family_label",
          "facet.field=qualifier",
          "facet.field=taxon_label",
          "facet.field=annotation_class_label",
          "facet.field=regulates_closure_label",
          "facet.field=annotation_extension_class_closure_label",
          "q=*%3A*",
        ].join("&"),
      ),
      true,
    );

    gm.page(7, 11);
    assert.equal(gm.get_query_url().includes("rows=7"), true);
    assert.equal(gm.get_query_url().includes("start=11"), true);

    gm.search();
    assert.equal(gm.get_query_url().includes("rows=10"), true);
    assert.equal(gm.get_query_url().includes("start=0"), true);
  });

  it("tracks packet counts and default query transitions", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    assert.equal(gm.last_packet_sent(), 0);
    gm.search();
    assert.equal(gm.last_packet_sent(), 1);

    gm.set_personality("annotation");
    assert.equal(gm.get_query(), "*:*");
    gm.set_query("foo");
    assert.equal(gm.get_query(), "foo");
    gm.reset_query();
    assert.equal(gm.get_query(), "*:*");

    gm.set_default_query("foo:bar");
    gm.reset_query();
    assert.equal(gm.get_query(), "foo:bar");
    gm.reset_default_query();
    gm.reset_query();
    assert.equal(gm.get_query(), "*:*");
  });

  it("handles personalities, query fields, comfy queries, and sensible query checks", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_query("foo");
    assert.equal(gm.get_personality(), null);
    gm.query_field_set({ label: 2.0, id: 1 });
    assert.equal(gm.get_query_url().includes("qf=label%5E2"), true);
    assert.equal(gm.get_query_url().includes("qf=id%5E1"), true);

    gm.set_personality("ontology");
    assert.equal(gm.get_personality(), "ontology");
    assert.equal(gm.get_query_url().includes("facet.field=subset"), true);
    assert.equal(gm.get_query_url().includes("qf=annotation_class_label_searchable%5E5.5"), true);

    gm.query_field_set({ label: 2.0, id: 1 });
    assert.equal(gm.get_query_url().includes("qf=label_searchable%5E2"), true);
    assert.equal(gm.get_query_url().includes("qf=id%5E1"), true);

    var comfy = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    comfy.set_comfy_query("fo");
    assert.equal(comfy.get_query(), "fo");
    comfy.set_comfy_query("foo");
    assert.equal(comfy.get_query(), "foo*");
    comfy.set_comfy_query("fork foo");
    assert.equal(comfy.get_query(), "fork foo*");
    comfy.set_comfy_query("fork foo ");
    assert.equal(comfy.get_query(), "fork foo ");
    comfy.set_comfy_query("fo_k foo");
    assert.equal(comfy.get_query(), "fo_k foo");

    assert.equal(comfy.sensible_query_p(), false);
    comfy.set_personality("annotation");
    comfy.set_comfy_query("fo");
    assert.equal(comfy.sensible_query_p(), false);
    comfy.set_comfy_query("foo");
    assert.equal(comfy.sensible_query_p(), true);
    comfy.set_comfy_query("");
    assert.equal(comfy.sensible_query_p(), true);
  });
});

describe("bbop-manager-golr state serialization", function () {
  it("manages bookmark loading and state urls", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_query("foo");
    gm.load_url("?personality=ontology");
    assert.equal(gm.get_personality(), "ontology");

    gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_query("foo");
    gm.load_url("?personality=ontology&fq=foo:bar&q=***");
    assert.equal(gm.get_query(), "***");
    assert.equal(gm.get_query_url().includes("fq=foo:%22bar%22"), true);

    gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_personality("annotation");
    gm.add_query_filter("document_category", "annotation", ["*"]);
    gm.add_query_filter("assigned_by", "MGI", ["-"]);
    gm.set_query("foo");
    var bookmark = gm.get_state_url();

    var m2 = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    m2.load_url(bookmark);
    assert.equal(linkComp(m2.get_state_url(), bookmark), true);
  });

  it("supports batch and excursion helpers", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    assert.equal(gm.batch_urls().length, 0);
    assert.equal(gm.next_batch_url(), null);

    var foo1 = gm.add_to_batch();
    gm.set_default_query("***");
    gm.add_to_batch();
    gm.set_default_query(":::");
    gm.add_to_batch();
    assert.equal(gm.batch_urls().length, 3);
    var foo2 = gm.next_batch_url();
    assert.equal(gm.batch_urls().length, 2);
    assert.equal(foo1, foo2);
    gm.reset_batch();
    assert.equal(gm.batch_urls().length, 0);

    gm.set_personality("ontology");
    gm.add_query_filter("abc", "def");
    var startUrl = gm.get_query_url();
    gm.push_excursion();
    gm.set_query("***");
    gm.pop_excursion();
    assert.equal(gm.get_query_url(), startUrl);
  });
});

describe("bbop-manager-golr query variants", function () {
  it("supports unset, highlighting, lite mode, facet limits, and results count", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set("foo", "bar");
    assert.equal(gm.get_query_url().includes("foo=bar"), true);
    assert.equal(gm.unset("foo"), true);
    assert.equal(gm.unset("foo"), false);

    assert.equal(gm.include_highlighting(false), false);
    assert.equal(gm.include_highlighting(), false);
    assert.equal(gm.include_highlighting(true), '<em class="hilite">');
    assert.equal(gm.get_query_url().includes("hl=true"), true);
    assert.equal(gm.include_highlighting(false), false);
    assert.equal(gm.include_highlighting(true, '<em class="blah">'), '<em class="blah">');

    assert.equal(gm.lite(), false);
    gm.set_personality("dsfsdfsdf");
    assert.equal(gm.lite(true), false);
    gm.set_personality("ontology");
    assert.equal(gm.lite(true), true);
    assert.equal(
      gm
        .get_query_url()
        .includes(
          "fl=annotation_class%2Cdescription%2Csource%2Csynonym%2Calternate_id%2Cannotation_class_label%2Cscore%2Cid",
        ),
      true,
    );
    assert.equal(gm.lite(false), false);

    assert.equal(gm.get_facet_limit(), 25);
    assert.equal(gm.get_facet_limit("foo"), null);
    assert.equal(gm.set_facet_limit(5), true);
    assert.equal(gm.get_facet_limit(), 5);
    assert.equal(gm.set_facet_limit("foo", 1), true);
    assert.equal(gm.get_facet_limit("foo"), 1);
    assert.equal(gm.reset_facet_limit("foo"), true);
    assert.equal(gm.get_facet_limit("foo"), null);
    assert.equal(gm.reset_facet_limit(), true);
    assert.equal(gm.get_facet_limit(), 25);

    assert.equal(gm.get_results_count(), 10);
    assert.equal(gm.set_results_count(25), 25);
    assert.equal(gm.get_results_count(), 25);
    assert.equal(gm.reset_results_count(), 10);
  });

  it("builds download urls and id-targeted queries", function () {
    var gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    var startUrl = gm.get_query_url();
    var dlUrl = gm.get_download_url(["foo", "bar"]);
    var endUrl = gm.get_query_url();
    assert.equal(linkComp(startUrl, endUrl), true);
    assert.equal(dlUrl.includes("wt=csv"), true);
    assert.equal(dlUrl.includes("fl=foo%2Cbar"), true);

    gm.set_personality("ontology");
    gm.add_query_filter("foo", "bar", ["-"]);
    gm.add_query_filter("123", "456", ["*"]);
    gm.add_query_filter("abc", "def", ["*", "-"]);
    dlUrl = gm.get_download_url(["id1", "id2"]);
    assert.equal(dlUrl.includes("fq=-foo:%22bar%22"), true);
    assert.equal(dlUrl.includes("fq=123:%22456%22"), true);
    assert.equal(dlUrl.includes("fq=-abc:%22def%22"), true);
    assert.equal(gm.get_query_filters().length, 3);
    assert.equal(gm.get_sticky_query_filters().length, 2);

    gm.set_personality("ontology");
    gm.set_query("***");
    gm.add_query_field("foo", 5.0);
    dlUrl = gm.get_download_url(["foo", "bar"]);
    assert.equal(dlUrl.includes("qf=foo%5E5"), true);

    gm = new golrManager("http://golr.berkeleybop.org/", makeConfig());
    gm.set_query("foo");
    gm.set_id("MGI:MGI:1");
    assert.equal(gm.get_query_url().includes("q=id%3A%22MGI%3AMGI%3A1%22"), true);
    gm.set_ids(["MGI:MGI:1", "MGI:MGI:2"]);
    assert.equal(
      gm.get_query_url().includes("q=id%3A(%22MGI%3AMGI%3A1%22%20OR%20%22MGI%3AMGI%3A2%22)"),
      true,
    );
    gm.set_targets(["GO:1", "GO:2"], ["field_1", "field_2"]);
    assert.equal(gm.get_query_url().includes("field_1%3A(%22GO%3A1%22%20OR%20%22GO%3A2%22)"), true);
    assert.equal(gm.get_query_url().includes("field_2%3A(%22GO%3A1%22%20OR%20%22GO%3A2%22)"), true);
  });
});
