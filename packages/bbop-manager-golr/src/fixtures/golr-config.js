const annotationFields = {
  source: { id: "source", searchable: false, cardinality: "single" },
  assigned_by: { id: "assigned_by", searchable: false, cardinality: "single" },
  aspect: { id: "aspect", searchable: false, cardinality: "single" },
  evidence_type_closure: { id: "evidence_type_closure", searchable: false, cardinality: "single" },
  panther_family_label: { id: "panther_family_label", searchable: false, cardinality: "single" },
  qualifier: { id: "qualifier", searchable: false, cardinality: "single" },
  taxon_label: { id: "taxon_label", searchable: false, cardinality: "single" },
  annotation_class_label: {
    id: "annotation_class_label",
    searchable: false,
    cardinality: "single",
  },
  regulates_closure_label: {
    id: "regulates_closure_label",
    searchable: false,
    cardinality: "single",
  },
  annotation_extension_class_closure_label: {
    id: "annotation_extension_class_closure_label",
    searchable: false,
    cardinality: "single",
  },
  annotation_class: { id: "annotation_class", searchable: false, cardinality: "single" },
  annotation_class_label_searchable: {
    id: "annotation_class_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  bioentity: { id: "bioentity", searchable: false, cardinality: "single" },
  bioentity_label: { id: "bioentity_label", searchable: false, cardinality: "single" },
  bioentity_label_searchable: {
    id: "bioentity_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  bioentity_name_searchable: {
    id: "bioentity_name_searchable",
    searchable: false,
    cardinality: "single",
  },
  annotation_extension_class: {
    id: "annotation_extension_class",
    searchable: false,
    cardinality: "single",
  },
  annotation_extension_class_label_searchable: {
    id: "annotation_extension_class_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  reference_searchable: { id: "reference_searchable", searchable: false, cardinality: "single" },
  panther_family_searchable: {
    id: "panther_family_searchable",
    searchable: false,
    cardinality: "single",
  },
  panther_family_label_searchable: {
    id: "panther_family_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  bioentity_isoform: { id: "bioentity_isoform", searchable: false, cardinality: "single" },
  regulates_closure: { id: "regulates_closure", searchable: false, cardinality: "single" },
  regulates_closure_label_searchable: {
    id: "regulates_closure_label_searchable",
    searchable: false,
    cardinality: "single",
  },
};

const ontologyFields = {
  source: { id: "source", searchable: false, cardinality: "single" },
  subset: { id: "subset", searchable: false, cardinality: "single" },
  regulates_closure_label: {
    id: "regulates_closure_label",
    searchable: false,
    cardinality: "single",
  },
  is_obsolete: { id: "is_obsolete", searchable: false, cardinality: "single" },
  annotation_class: { id: "annotation_class", searchable: false, cardinality: "single" },
  annotation_class_label: {
    id: "annotation_class_label",
    searchable: false,
    cardinality: "single",
  },
  annotation_class_label_searchable: {
    id: "annotation_class_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  description: { id: "description", searchable: true, cardinality: "single" },
  description_searchable: {
    id: "description_searchable",
    searchable: false,
    cardinality: "single",
  },
  comment_searchable: { id: "comment_searchable", searchable: false, cardinality: "single" },
  synonym: { id: "synonym", searchable: true, cardinality: "single" },
  synonym_searchable: { id: "synonym_searchable", searchable: false, cardinality: "single" },
  regulates_closure: { id: "regulates_closure", searchable: false, cardinality: "single" },
  regulates_closure_label_searchable: {
    id: "regulates_closure_label_searchable",
    searchable: false,
    cardinality: "single",
  },
  alternate_id: { id: "alternate_id", searchable: false, cardinality: "single" },
  label: { id: "label", searchable: true, cardinality: "single" },
  id: { id: "id", searchable: false, cardinality: "single" },
};

export default {
  annotation: {
    id: "annotation",
    display_name: "Annotation",
    description: "Annotation personality",
    weight: 10,
    document_category: "annotation",
    filter_weights:
      "source^10 assigned_by^9 aspect^8 evidence_type_closure^7 panther_family_label^6 qualifier^5 taxon_label^4 annotation_class_label^3 regulates_closure_label^2 annotation_extension_class_closure_label^1",
    boost_weights:
      "annotation_class^2 annotation_class_label_searchable^1 bioentity^2 bioentity_label_searchable^1 bioentity_name_searchable^1 annotation_extension_class^2 annotation_extension_class_label_searchable^1 reference_searchable^1 panther_family_searchable^1 panther_family_label_searchable^1 bioentity_isoform^1 regulates_closure^1 regulates_closure_label_searchable^1",
    result_weights:
      "annotation_class^2 bioentity^2 source^1 assigned_by^1 annotation_extension_class^1 regulates_closure^1",
    fields_hash: annotationFields,
  },
  ontology: {
    id: "ontology",
    display_name: "Ontology",
    description: "Ontology personality",
    weight: 9,
    document_category: "ontology_class",
    filter_weights: "source^10 subset^9 regulates_closure_label^8 is_obsolete^7",
    boost_weights:
      "annotation_class^3 annotation_class_label_searchable^5.5 description_searchable^1 comment_searchable^0.5 synonym_searchable^1 regulates_closure^1 regulates_closure_label_searchable^1 alternate_id^1",
    result_weights: "annotation_class^4 description^3 source^2 synonym^1 alternate_id^1",
    fields_hash: ontologyFields,
  },
};
