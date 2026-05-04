import { describe, it } from "node:test";
import { assert } from "chai";
import Response from "./response.js";

describe("bbop-response-golr basics", function () {
  it("handles success, paging, facets, and query filters", function () {
    var raw = {
      responseHeader: {
        status: 0,
        QTime: 10,
        params: {
          facet: "true",
          indent: "on",
          "facet.mincount": "1",
          "json.nl": "arrarr",
          wt: "json",
          callback_type: "search",
          rows: "10",
          fl: "*,score",
          start: "0",
          q: "*: *".replace(" ", ""),
          packet: "5",
          "facet.field": [
            "source",
            "evidence_type",
            "taxon_label",
            "isa_partof_closure_label",
            "annotation_extension_class_closure_label",
          ],
          qt: "standard",
          fq: [
            'document_category:"annotation"',
            'isa_partof_closure:"GO:0022008"',
            '-source:"MGI"',
            '-evidence_type:"ISO"',
            'isa_partof_closure_label:"cell recognition"',
            'taxon_label:"Mus musculus"',
          ],
        },
      },
      response: {
        numFound: 8,
        start: 0,
        maxScore: 1.0,
        docs: [{}, {}, {}, {}, {}, {}, {}, {}],
      },
      facet_counts: {
        facet_queries: {},
        facet_fields: {
          source: [
            ["UniProtKB", 7],
            ["BHF-UCL", 1],
          ],
          evidence_type: [
            ["IMP", 5],
            ["IGI", 1],
            ["ISS", 1],
            ["TAS", 1],
          ],
          taxon_label: [["Mus musculus", 8]],
          isa_partof_closure_label: [
            ["anatomical structure development", 8],
            ["axonogenesis", 6],
            ["cell recognition", 8],
          ],
          annotation_extension_class_closure_label: [],
        },
        facet_dates: {},
        facet_ranges: {},
      },
    };

    var response = new Response(raw);

    assert.isTrue(response.success(), "successful response");
    assert.isTrue(response.okay(), "okay aliases success");
    assert.equal(response.callback_type(), "search", "callback type extracted");
    assert.equal(response.parameter("rows"), "10", "single parameter access");
    assert.equal(response.row_step(), 10, "row step parsed");
    assert.equal(response.total_documents(), 8, "document count");
    assert.equal(response.start_document(), 1, "start document is 1-based");
    assert.equal(response.end_document(), 8, "end document derived");
    assert.equal(response.documents().length, 8, "documents returned");
    assert.sameMembers(
      response.facet_field_list(),
      [
        "source",
        "evidence_type",
        "taxon_label",
        "isa_partof_closure_label",
        "annotation_extension_class_closure_label",
      ],
      "facet fields listed",
    );
    assert.deepEqual(
      response.facet_field("evidence_type"),
      [
        ["IMP", 5],
        ["IGI", 1],
        ["ISS", 1],
        ["TAS", 1],
      ],
      "facet field values preserved",
    );
    assert.equal(response.query(), "*:*", "query extracted");
    assert.isTrue(response.query_filters().document_category.annotation, "positive filter parsed");
    assert.isTrue(response.query_filters().isa_partof_closure["GO:0022008"], "go id filter parsed");
    assert.isTrue(
      response.query_filters().isa_partof_closure_label["cell recognition"],
      "quoted label parsed",
    );
    assert.isTrue(response.query_filters().taxon_label["Mus musculus"], "taxon label parsed");
    assert.isFalse(response.query_filters().source.MGI, "negative source filter parsed");
    assert.isFalse(response.query_filters().evidence_type.ISO, "negative evidence filter parsed");
    assert.isFalse(response.paging_p(), "no paging needed");
    assert.isFalse(response.paging_previous_p(), "no previous page");
    assert.isFalse(response.paging_next_p(), "no next page");
    assert.equal(response.packet(), 5, "packet parsed");
    assert.equal(response.facet_counts().source["BHF-UCL"], 1, "facet count flattened");
    assert.equal(
      response.facet_counts().isa_partof_closure_label.axonogenesis,
      6,
      "second facet count flattened",
    );
  });
});

describe("bbop-response-golr document helpers", function () {
  it("resolves documents, labels, and highlights", function () {
    var raw = {
      responseHeader: {
        status: 0,
        QTime: 23,
        params: {
          facet: "true",
          "facet.mincount": "1",
          indent: "on",
          qf: [
            "annotation_class^2",
            "annotation_class_label_searchable^1",
            "bioentity^2",
            "bioentity_label_searchable^1",
            "annotation_extension_class^2",
            "annotation_extension_class_label_searchable^1",
          ],
          "hl.simple.pre": '<em class="hilite">',
          "json.nl": "arrarr",
          wt: "json",
          callback_type: "search",
          hl: "true",
          rows: "2",
          defType: "edismax",
          fl: "*,score",
          start: "0",
          q: "tag*",
          packet: "2",
          "facet.field": [
            "source",
            "evidence_type",
            "taxon_label",
            "isa_partof_closure_label",
            "annotation_extension_class_closure_label",
          ],
          qt: "standard",
          fq: 'document_category:"annotation"',
        },
      },
      response: {
        numFound: 48,
        start: 0,
        maxScore: 1.0,
        docs: [
          {
            document_category: "annotation",
            id: "PomBase:SPCC548.04_:_GO:0031386",
            bioentity: "PomBase:SPCC548.04",
            bioentity_label: "urm1",
            bioentity_label_searchable: "urm1",
            source: "PomBase",
            date: "20051107",
            taxon: "NCBITaxon:4896",
            taxon_label: "Schizosaccharomyces pombe",
            taxon_label_searchable: "Schizosaccharomyces pombe",
            reference: "GO_REF:0000024",
            evidence_type: "ISO",
            annotation_class: "GO:0031386",
            annotation_class_label: "protein tag",
            annotation_class_label_searchable: "protein tag",
            isa_partof_closure_map:
              '{"GO:0003674":"molecular_function","GO:0031386":"protein tag"}',
            isa_partof_closure: ["GO:0003674", "GO:0031386"],
            isa_partof_closure_label: ["molecular_function", "protein tag"],
            evidence_with: ["SGD:S000001270"],
            isa_partof_closure_label_searchable: ["molecular_function", "protein tag"],
            score: 1.0,
          },
          {
            document_category: "annotation",
            id: "PomBase:SPAC1783.06c_:_GO:0031386",
            bioentity: "PomBase:SPAC1783.06c",
            bioentity_label: "atg12",
            bioentity_label_searchable: "atg12",
            source: "PomBase",
            date: "20091125",
            taxon: "NCBITaxon:4896",
            taxon_label: "Schizosaccharomyces pombe",
            taxon_label_searchable: "Schizosaccharomyces pombe",
            reference: "GO_REF:0000024",
            evidence_type: "ISS",
            annotation_class: "GO:0031386",
            annotation_class_label: "protein tag",
            annotation_class_label_searchable: "protein tag",
            isa_partof_closure_map:
              '{"GO:0003674":"molecular_function","GO:0031386":"protein tag"}',
            isa_partof_closure: ["GO:0003674", "GO:0031386"],
            isa_partof_closure_label: ["molecular_function", "protein tag"],
            evidence_with: ["SGD:S000000421"],
            isa_partof_closure_label_searchable: ["molecular_function", "protein tag"],
            score: 1.0,
          },
        ],
      },
      facet_counts: {
        facet_queries: {},
        facet_fields: {
          source: [["PomBase", 5]],
          evidence_type: [["ISS", 22]],
          taxon_label: [["Schizosaccharomyces pombe", 5]],
          isa_partof_closure_label: [["protein tag", 8]],
          annotation_extension_class_closure_label: [],
        },
        facet_dates: {},
        facet_ranges: {},
      },
      highlighting: {
        "PomBase:SPCC548.04_:_GO:0031386": {
          annotation_class_label_searchable: ['protein <em class="hilite">tag</em>'],
        },
        "PomBase:SPAC1783.06c_:_GO:0031386": {
          annotation_class_label_searchable: ['protein <em class="hilite">tag</em>'],
        },
      },
    };

    var response = new Response(raw);
    var firstId = "PomBase:SPCC548.04_:_GO:0031386";

    assert.equal(response.get_doc(0).id, firstId, "document by index");
    assert.equal(
      response.get_doc(1).id,
      "PomBase:SPAC1783.06c_:_GO:0031386",
      "second document by index",
    );
    assert.equal(response.get_doc(2), null, "missing document by index");
    assert.equal(response.get_doc(firstId).id, firstId, "document by id");
    assert.equal(response.get_doc("foo"), null, "missing document by id");

    assert.equal(response.get_doc_field(0, "id"), firstId, "field by index");
    assert.equal(response.get_doc_field(firstId, "id"), firstId, "field by id");
    assert.equal(response.get_doc_field("foo", "id"), null, "missing field");

    assert.equal(
      response.get_doc_highlight(0, "id", "protein tag"),
      null,
      "no highlight for plain field",
    );
    assert.equal(
      response.get_doc_highlight(1, "foo", "protein tag"),
      null,
      "no highlight for missing field",
    );
    assert.equal(
      response.get_doc_highlight(firstId, "annotation_class_label_searchable", "protein tag"),
      'protein <em class="hilite">tag</em>',
      "highlight by id",
    );
    assert.equal(
      response.get_doc_highlight(1, "annotation_class_label_searchable", "protein tag"),
      'protein <em class="hilite">tag</em>',
      "highlight by index",
    );

    assert.equal(response.get_doc_label(0, "bioentity"), "urm1", "trivial label lookup");
    assert.equal(response.get_doc_label(0, "evidence_with"), null, "no label data available");
    assert.equal(
      response.get_doc_label(0, "isa_partof_closure"),
      null,
      "ambiguous labels require item id",
    );
    assert.equal(
      response.get_doc_label(0, "isa_partof_closure", "GO:0003674"),
      "molecular_function",
      "map label lookup",
    );
    assert.equal(
      response.get_doc_label(0, "isa_partof", "GO:0003674"),
      null,
      "missing field returns null",
    );
  });
});
