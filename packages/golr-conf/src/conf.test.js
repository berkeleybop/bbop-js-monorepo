import { describe, it } from "node:test";
import { assert } from "chai";
import golrConf from "./conf.js";
import golrConfigFixture from "./fixtures/golr-config.js";

describe("golr-conf.conf_field", function () {
  it("exposes field metadata", function () {
    var fconf = golrConfigFixture.ontology.fields_hash.source;
    var cf = new golrConf.conf_field(fconf);

    assert.equal(cf._is_a, "golr-conf.conf_field");
    assert.equal(cf.display_name(), "Ontology source");
    assert.equal(cf.description(), "Term namespace.");
    assert.equal(cf.id(), "source");
    assert.equal(cf.searchable(), false);
    assert.equal(cf.required(), false);
    assert.equal(cf.is_multi(), false);
    assert.equal(cf.is_fixed(), false);
    assert.equal(cf.property(), "getNamespace");
  });
});

describe("golr-conf.conf_class", function () {
  it("exposes class metadata and field weighting", function () {
    var cc = new golrConf.conf_class(golrConfigFixture.annotation);

    assert.equal(cc._is_a, "golr-conf.conf_class");
    assert.equal(cc.display_name(), "Annotations");
    assert.equal(cc.description(), "Associations between GO terms and genes or gene products.");
    assert.equal(cc.weight(), 20);
    assert.equal(cc.id(), "annotation");
    assert.equal(cc.searchable_extension(), "_searchable");
    assert.equal(cc.get_field("blork"), null);
    assert.equal(cc.get_field("source").id(), "source");
    assert.equal(cc.get_fields().length, 11);

    var boosts = cc.get_weights("boost");
    assert.equal(boosts.bioentity, 2.0);
    assert.equal(boosts.ashdlas, null);

    var orderedFilterList7 = cc.field_order_by_weight("filter", 5.0);
    assert.equal(orderedFilterList7.length, 7);
    assert.deepEqual(orderedFilterList7, [
      "source",
      "assigned_by",
      "aspect",
      "evidence_type_closure",
      "panther_family_label",
      "qualifier",
      "taxon_label",
    ]);

    var orderedFilterListAll = cc.field_order_by_weight("filter");
    assert.equal(orderedFilterListAll.length, 11);
    assert.equal(orderedFilterListAll[0], "source");
  });
});

describe("top-level golr-conf.conf", function () {
  it("indexes classes and orders them by weight", function () {
    var c = new golrConf.conf(golrConfigFixture);

    assert.equal(c._is_a, "golr-conf.conf");
    assert.equal(c.get_class("ontology").display_name(), "Ontology");
    assert.equal(c.get_classes().length, 8);

    var orderedClasses = c.get_classes_by_weight();
    assert.equal(orderedClasses.length, 8);
    assert.equal(orderedClasses[0].id(), "ontology");
    assert.equal(orderedClasses[7].id(), "bbop_ann_ev_agg");
  });
});
