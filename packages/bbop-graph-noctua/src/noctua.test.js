import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { assert } from "chai";
import model from "./noctua.js";

const modelA = "gomodel:5525a0fc00000001";
const seedA = "obo:#5525a0fc00000001%2F5595c4cb00000425";
const leafA = "gomodel:5525a0fc00000001/5525a0fc0000023";
const nodeA = "obo:#5525a0fc00000001%2F5595c4cb00000431";

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function loadGraph(name) {
  var raw = loadFixture(name);
  var graph = new model.graph();
  graph.load_data_basic(raw.data);
  return graph;
}

function loadStandardGraph() {
  return loadGraph("minerva-03.json");
}

describe("annotation helpers", function () {
  it("store values and are queryable from graph context", function () {
    var graph = new model.graph();
    var annotation = new model.annotation({ key: "foo", value: "bar" });

    assert.isString(annotation.id(), "string id");
    assert.equal(annotation.key(), "foo", "has key");
    assert.equal(annotation.value(), "bar", "has value");
    assert.equal(annotation.value_type(), null, "has no value-type");

    annotation.annotation("1", "2", "3");
    graph.add_annotation(annotation);

    assert.deepEqual(
      annotation.annotation(),
      { key: "1", value: "2", "value-type": "3" },
      "annotation is updated",
    );
    assert.equal(
      graph.get_annotation_by_id(annotation.id()).id(),
      annotation.id(),
      "graph lookup works",
    );
    assert.equal(graph.get_annotations_by_key("1").length, 1, "graph key lookup works");
  });
});

describe("minerva loading", function () {
  it("loads graph metadata, node types, and edge ids", function () {
    var graph = loadStandardGraph();

    assert.equal(graph.id(), modelA, "graph id");
    assert.equal(graph.annotations().length, 4, "graph annotations loaded");
    assert.equal(graph.all_nodes().length, 22, "node count loaded");
    assert.equal(graph.all_edges().length, 14, "edge count loaded");

    var node = graph.get_node(leafA);
    assert.equal(node.types().length, 1, "node types loaded");
    assert.equal(node.types()[0].class_id(), "GO:0005515", "node type id loaded");
    assert.equal(node.types()[0].class_label(), "protein binding", "node type label loaded");

    var edge = graph.all_edges()[0];
    assert.equal(graph.get_edge_by_id(edge.id()).id(), edge.id(), "edge ids are tracked");
  });

  it("loads edge labels from the wire protocol", function () {
    var graph = loadGraph("minerva-07.json");
    var edge = graph.all_edges()[0];

    assert.isString(edge.label(), "label is available");
    assert.notEqual(edge.id(), edge.label(), "edge label is distinct from edge id");
  });
});

describe("evidence folding", function () {
  it("folds evidence into referenced subgraphs and extracts simple evidence", function () {
    var graph = loadStandardGraph();
    graph.fold_evidence();

    assert.equal(graph.all_nodes().length, 14, "evidence nodes are folded away");

    var node = graph.get_node(leafA);
    assert.equal(node.referenced_subgraphs().length, 1, "one referenced subgraph remains");

    var profiles = node.get_referenced_subgraph_profiles();
    assert.equal(profiles.length, 1, "one evidence profile extracted");
    assert.equal(profiles[0].class_expressions.length, 1, "profile retains class expression");
    assert.equal(profiles[0].annotations.length, 1, "profile retains annotation");

    var evidence = node.get_basic_evidence(["source"]);
    assert.equal(evidence.length, 1, "simple evidence extracted");
    assert.equal(evidence[0].cls, "physical interaction evidence", "evidence class is readable");
    assert.equal(evidence[0].source, "PMID:12048186", "evidence source is retained");
  });

  it("finds evidence seeds and cliques", function () {
    var graph = loadStandardGraph();

    assert.equal(
      Object.keys(graph.extract_evidence_seeds()).length,
      8,
      "all seeds are discoverable",
    );

    var clique = graph.get_evidence_clique(seedA);
    var subclique = graph.get_evidence_subclique(seedA);

    assert.equal(clique.id(), seedA, "clique keeps seed id");
    assert.equal(clique.all_nodes().length, 1, "simple clique has one node");
    assert.equal(subclique.id(), seedA, "subclique keeps seed id");
    assert.equal(subclique.all_nodes().length, 1, "simple subclique has one node");
  });
});

describe("noctua folding modes", function () {
  it("folds and unfolds go-noctua subgraphs including reverse relations", function () {
    var graph = loadGraph("minerva-05.json");
    var relations = ["RO:0002333", "BFO:0000066", "RO:0002233", "RO:0002488"];
    var reverseRelations = ["BFO:0000051"];

    assert.equal(graph.all_nodes().length, 12, "pre-fold node count");
    assert.equal(graph.all_edges().length, 5, "pre-fold edge count");

    graph.fold_go_noctua(relations, reverseRelations);
    assert.equal(graph.all_nodes().length, 3, "folded node count");
    assert.equal(graph.all_edges().length, 1, "folded edge count");

    graph.unfold();
    assert.equal(graph.all_nodes().length, 12, "unfold restores nodes");
    assert.equal(graph.all_edges().length, 5, "unfold restores edges");
  });

  it("survives repeated deep folding and unfolding", function () {
    var graph = loadGraph("minerva-09.json");
    var relations = [
      "RO:0002233",
      "RO:0002234",
      "RO:0002333",
      "RO:0002488",
      "BFO:0000066",
      "BFO:0000051",
      "RO:0000053",
    ];

    for (var i = 0; i < 100; i++) {
      assert.equal(graph.all_nodes().length, 8, `nodes before cycle ${i}`);
      assert.equal(graph.all_edges().length, 7, `edges before cycle ${i}`);
      graph.fold_go_noctua(relations);
      graph.unfold();
      assert.equal(graph.all_nodes().length, 8, `nodes after cycle ${i}`);
      assert.equal(graph.all_edges().length, 7, `edges after cycle ${i}`);
    }
  });
});

describe("graph updates", function () {
  it("distinguishes update_with from merge_special in folded graphs", function () {
    var relations = ["RO:0002333", "BFO:0000066"];
    var baseForUpdate = loadStandardGraph();
    var baseForMerge = loadStandardGraph();
    var updateGraph = new model.graph();

    baseForUpdate.fold_go_noctua(relations);
    baseForMerge.fold_go_noctua(relations);

    updateGraph.add_annotation(new model.annotation({ key: "title", value: "meow" }));
    updateGraph.add_node(new model.node(leafA));
    updateGraph.add_node(new model.node(nodeA));
    updateGraph.add_node(new model.node("blahblah"));
    updateGraph.add_edge(new model.edge(leafA, nodeA, "RO:1234567"));

    baseForUpdate.update_with(updateGraph);
    assert.equal(baseForUpdate.annotations().length, 1, "update_with replaces graph annotations");
    assert.equal(baseForUpdate.all_nodes().length, 9, "update_with keeps folded duplicate nodes");
    assert.equal(
      baseForUpdate.all_edges().length,
      4,
      "update_with replaces local edges for updated nodes",
    );

    baseForMerge.merge_special(updateGraph);
    assert.equal(baseForMerge.annotations().length, 1, "merge_special replaces graph annotations");
    assert.equal(baseForMerge.all_nodes().length, 9, "merge_special keeps node counts aligned");
    assert.equal(baseForMerge.all_edges().length, 8, "merge_special keeps non-overlapping edges");
  });

  it("merges noctua metadata into an empty graph", function () {
    var incoming = loadStandardGraph();
    var graph = new model.graph();

    incoming.fold_evidence();
    graph.merge_in(incoming);

    assert.equal(graph.all_nodes().length, 14, "merged nodes preserved");
    assert.equal(graph.all_edges().length, 14, "merged edges preserved");
    assert.equal(graph.annotations().length, 4, "graph annotations merge in");
    assert.isString(graph.get_node_elt_id(graph.all_nodes()[0].id()), "node elt ids are created");
  });
});

describe("validation metadata", function () {
  it("tracks inconsistent and modified flags through clone", function () {
    var raw = loadFixture("minerva-03.json");
    raw.data["inconsistent-p"] = true;
    raw.data["modified-p"] = true;

    var graph = new model.graph();
    graph.load_data_basic(raw.data);
    var clone = graph.clone();

    assert.equal(graph.inconsistent_p(), true, "inconsistent flag loaded");
    assert.equal(graph.modified_p(), true, "modified flag loaded");
    assert.equal(clone.inconsistent_p(), true, "inconsistent flag cloned");
    assert.equal(clone.modified_p(), true, "modified flag cloned");
  });

  it("loads validation results, violations, inferred closures, and root types", function () {
    var invalidGraph = loadGraph("response-gomodel-5d88482400000052-2019-09-25.json");
    var validGraph = loadGraph("response-gomodel-R-HSA-159740-2019-09-26.json");
    var rootedGraph = loadGraph("response-gomodel-596ef51500000088-2020-07-01.json");

    assert.equal(invalidGraph.valid_p(), false, "overall validity loaded");
    assert.equal(invalidGraph.valid_owl_p(), true, "owl validity loaded");
    assert.equal(invalidGraph.valid_shex_p(), false, "shex validity loaded");
    assert.equal(invalidGraph.violations().length, 2, "violations loaded");
    assert.equal(
      invalidGraph.get_violations_by_id("gomodel:5d88482400000052/5d88482400000080").length,
      1,
      "violations are queryable by node id",
    );

    var inferredNode = invalidGraph.get_node("gomodel:5d88482400000052/5d88482400000053");
    assert.equal(inferredNode.types().length, 1, "base type retained");
    assert.equal(inferredNode.inferred_types().length, 0, "direct inferred types retained");
    assert.equal(inferredNode.inferred_types_with_all().length, 12, "inferred closure retained");

    assert.equal(validGraph.valid_p(), true, "valid graph remains conformant");
    assert.equal(validGraph.violations().length, 0, "valid graph has no violations");

    var rootedNode = rootedGraph.get_node("gomodel:596ef51500000088/5b91dbd100000466");
    assert.equal(rootedNode.root_types().length, 3, "root types are loaded when present");
    assert.equal(rootedNode.get_unique_root_types().length, 3, "root type helper remains usable");
  });
});
