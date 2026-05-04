////
//// Some unit testing for bbop-core.
////
import { describe, it } from "node:test";
import { assert } from "chai";
import us from "underscore";

import bbop from "./core.js";

var each = us.each;

///
/// Test helper functions; some from old bbop.tests
///

// Are two arrays the same, including order?
function _same_array(one, two) {
  var retval = true;
  if (one.length != two.length) {
    retval = false;
  } else {
    for (var i = 0; i < one.length; i++) {
      if (one[i] != two[i]) {
        retval = false;
        break;
      }
    }
  }
  return retval;
}

// Are two URLs the same.
function _link_comp(str1, str2) {
  // Decompose links and arguments.
  var tmp1 = str1.split("?");
  var head1 = "";
  var args1 = [];
  if (!tmp1[1]) {
    // nothing before '?'
    args1 = tmp1[0].split("&");
  } else {
    // normal structure
    head1 = tmp1[0];
    args1 = tmp1[1].split("&");
  }
  var sorted_args1 = args1.sort();

  var tmp2 = str2.split("?");
  var head2 = "";
  var args2 = [];
  if (!tmp2[1]) {
    // nothing before '?'
    args2 = tmp2[0].split("&");
  } else {
    // normal structure
    head2 = tmp2[0];
    args2 = tmp2[1].split("&");
  }
  var sorted_args2 = args2.sort();

  // var tmp2 = str2.split('?');
  // var head2 = tmp2[0];
  // var args2 = tmp2[1].split('&');
  // var sorted_args2 = args2.sort();

  // Compare heads and arguments.
  var retval = false;
  if (head1 == head2 && _same_array(sorted_args1, sorted_args2)) {
    retval = true;
  }
  return retval;
}

///
/// Start unit testing.
///

describe("fundamental unit tests", function () {
  it("cloning", function () {
    var o1 = { foo: 1, bar: 2 };
    var o2 = bbop.clone(o1);
    assert.deepEqual(o1, o2);
  });

  // // Namespace generation.
  // bbop.namespace("happy", "bar");
  // mr_t.is_defined(happy.bar, "made namespace");
  // happy.bar.prop = true;
  // assert.equal(true, happy.bar.prop, "added prop to new NS");

  it("each: array iterator", function () {
    var sum_val = 0;
    var sum_i = 0;
    var sum_array = [1, 2, 3];
    function sum_add(in_num, in_index) {
      sum_val = sum_val + in_num;
      sum_i = in_index;
    }
    each(sum_array, sum_add);
    assert.equal(6, sum_val, "iterated value");
    assert.equal(2, sum_i, "iterated index");
  });

  it("each: hash iterator", function () {
    var sum_val = 0;
    var sum_s = "";
    var sum_hash = { dog: 2, cat: 4, cow: 6 };
    function sum_add(in_val, in_key) {
      sum_val = sum_val + in_val;
      sum_s = sum_s + in_key;
    }
    each(sum_hash, sum_add);
    assert.equal(9, sum_s.length, "iterated key");
    assert.equal(12, sum_val, "iterated value");
  });

  it("pare: for arrays", function () {
    var ir1 = [1, 2, 3, 4, 5];

    var or1 = bbop.pare(ir1, null, null);
    assert.equal(5, or1.length, "ir1 test 1");
    assert.equal(1, or1[0], "ir1 test 2");
    assert.equal(5, or1[4], "ir1 test 3");

    var or2 = bbop.pare(
      ir1,
      function (item, i) {
        // remove even index items
        if (i % 2 == 0) {
          return true;
        } else {
          return false;
        }
      },
      null,
    );
    assert.equal(2, or2.length, "ir1 test 4");
    assert.equal(2, or2[0], "ir1 test 5");
    assert.equal(4, or2[1], "ir1 test 6");

    var or3 = bbop.pare(
      ir1,
      function (item) {
        // remove even items
        if (item % 2 == 0) {
          return true;
        } else {
          return false;
        }
      },
      function (a, b) {
        // reverse order
        if (a > b) {
          return -1;
        } else if (b > a) {
          return 1;
        } else {
          return 0;
        }
      },
    );
    assert.equal(3, or3.length, "ir1 test 7");
    assert.equal(5, or3[0], "ir1 test 8");
    assert.equal(1, or3[2], "ir1 test 9");

    var ir2 = [
      { a: 1, b: 2 },
      { a: 3, b: 4 },
      { a: 5, b: 6 },
      { a: 7, b: 8 },
      { a: 9, b: 10 },
    ];

    var or4 = bbop.pare(
      ir2,
      function (item) {
        // remove a's % 3
        if (item["a"] % 3 == 0) {
          return true;
        } else {
          return false;
        }
      },
      function (a, b) {
        // reverse order
        if (a["b"] > b["b"]) {
          return -1;
        } else if (b["b"] > a["b"]) {
          return 1;
        } else {
          return 0;
        }
      },
    );
    assert.equal(3, or4.length, "ir2 test 1");
    assert.equal(8, or4[0]["b"], "ir2 test 2");
    assert.equal(2, or4[2]["b"], "ir2 test 3");
  });

  it("pare: for hashes", function () {
    var ir1 = {
      u: { a: 1, b: 2 },
      v: { a: 3, b: 4 },
      x: { a: 5, b: 6 },
      y: { a: 7, b: 8 },
      z: { a: 9, b: 10 },
    };

    var or1 = bbop.pare(ir1, null, null);
    assert.equal(5, or1.length, "hash ir1 test 1");
    assert.equal(1, or1[0]["a"], "hash ir1 test 2");
    assert.equal(10, or1[4]["b"], "hash ir1 test 3");

    var or2 = bbop.pare(
      ir1,
      function (key, val) {
        // remove b's smaller than 5
        if (val["b"] < 5) {
          return true;
        } else {
          return false;
        }
      },
      null,
    );
    assert.equal(3, or2.length, "hash ir1 test 4");
    assert.equal(5, or2[0]["a"], "hash ir1 test 5");
    assert.equal(10, or2[2]["b"], "hash ir1 test 6");

    var or3 = bbop.pare(
      ir1,
      function (key) {
        // remove 'x' item
        if (key == "x") {
          return true;
        } else {
          return false;
        }
      },
      function (a, b) {
        // reverse order on b
        if (a.b > b.b) {
          return -1;
        } else if (b.b > a.b) {
          return 1;
        } else {
          return 0;
        }
      },
    );
    assert.equal(4, or3.length, "hash ir1 test 7");
    assert.equal(9, or3[0].a, "hash ir1 test 8");
    assert.equal(2, or3[3].b, "hash ir1 test 9");

    //      var or4 = bbop.pare(ir2,
    // 			      function(item, i){ // remove a's % 3
    // 				  if( item['a'] % 3 == 0 ){
    // 				      return true;
    // 				  }else{
    // 				      return false;
    // 				  }
    // 			      },
    // 			      function(a, b){ // reverse order
    // 				  if( a['b'] > b['b'] ){
    // 				      return -1;
    // 				  }else if( b['b'] > a['b'] ){
    // 				      return 1;
    // 				  }else{
    // 				      return 0;
    // 				  }
    // 			      });
    //      assert.equal(3, or4.length, "ir2 test 1");
    //      assert.equal(8, or4[0]['b'], "ir2 test 2");
    //      assert.equal(2, or4[2]['b'], "ir2 test 3");
  });

  it("get_keys", function () {
    var hash1 = { foo: 3 };
    var keys1 = bbop.get_keys(hash1);
    assert.equal(1, keys1.length, "got keys1 len");
    assert.equal("foo", keys1[0], "got keys1 str 0");

    var hash2 = { foo: 3, bar: 4 };
    var keys2 = bbop.get_keys(hash2);
    keys2.sort();
    assert.equal(2, keys2.length, "got keys2 len");
    assert.equal("bar", keys2[0], "got keys2 str 0");
    assert.equal("foo", keys2[1], "got keys2 str 1");
  });

  it("is_array", function () {
    var t1 = 1;
    var t2 = "moo";
    var t3 = [];
    var t4 = {};
    var t5 = ["moo"];
    var t6 = { cow: "moo" };
    var t7 = function () {
      return true;
    };

    assert.isFalse(bbop.is_array(t1), "correctly is_array t1");
    assert.isFalse(bbop.is_array(t2), "correctly is_array t2");
    assert.isTrue(bbop.is_array(t3), "correctly is_array t3");
    assert.isFalse(bbop.is_array(t4), "correctly is_array t4");
    assert.isTrue(bbop.is_array(t5), "correctly is_array t5");
    assert.isFalse(bbop.is_array(t6), "correctly is_array t6");
    assert.isFalse(bbop.is_array(t7), "correctly is_array t7");
  });

  it("is_hash", function () {
    var t1 = 1;
    var t2 = "moo";
    var t3 = [];
    var t4 = {};
    var t5 = ["moo"];
    var t6 = { cow: "moo" };
    var t7 = function () {
      return true;
    };

    assert.isFalse(bbop.is_hash(t1), "correctly is_hash t1");
    assert.isFalse(bbop.is_hash(t2), "correctly is_hash t2");
    assert.isFalse(bbop.is_hash(t3), "correctly is_hash t3");
    // ...?
    assert.isTrue(bbop.is_hash(t4), "correctly is_hash t4");
    assert.isFalse(bbop.is_hash(t5), "correctly is_hash t5");
    assert.isTrue(bbop.is_hash(t6), "correctly is_hash t6");
    assert.isFalse(bbop.is_hash(t7), "correctly is_hash t7");
  });

  // // is_same.
  // (function(){
  //      var t0 = null;
  //      var t1 = 1;
  //      var t2 = 'moo';
  //      var t3 = [];
  //      var t4 = {};
  //      var t5 = ['moo', 'a'];
  //      var t6 = {'cow': 'moo'};
  //      var t7 = true;
  //      var t8 = false;
  //      var t9 = {'a': true, 'b': false};

  //      // Simple and true things.
  //      assert.isTrue(bbop.is_same(t0, null), "correctly is_same t0");
  //      assert.isTrue(bbop.is_same(t1, 1), "correctly is_same t1");
  //      assert.isTrue(bbop.is_same(t2, 'moo'), "correctly is_same t2");
  //      assert.isTrue(bbop.is_same(t3, []), "correctly is_same t3");
  //      assert.isTrue(bbop.is_same(t4, {}), "correctly is_same t4");
  //      assert.isTrue(bbop.is_same(t5, ['moo', 'a']), "correctly is_same t5");
  //      assert.isTrue(bbop.is_same(t6, {'cow': 'moo'}),
  // 		  "correctly is_same t6");
  //      assert.isTrue(bbop.is_same(t7, true), "correctly is_same t7");
  //      assert.isTrue(bbop.is_same(t8, false), "correctly is_same t8");

  //      // Apparently, harder.
  //      assert.isTrue(bbop.is_same(t9, {'a': true, 'b': false}),
  // 		  "correctly is_same t9");

  //      // Now wrong things.
  //      assert.isFalse(bbop.is_same(t0, 1), "not is_same t0");
  //      assert.isFalse(bbop.is_same(t1, '1'), "not is_same t1a");
  //      assert.isFalse(bbop.is_same(t1, 2), "not is_same t1b");
  //      assert.isFalse(bbop.is_same(t2, 'mo'), "not is_same t2");
  //      assert.isFalse(bbop.is_same(t3, null), "not is_same t3a");
  //      assert.isFalse(bbop.is_same(t3, ['a']), "not is_same t3b");
  //      assert.isFalse(bbop.is_same(t4, null), "not is_same t4a");
  //      assert.isFalse(bbop.is_same(t4, {'a': 1}), "not is_same t4b");
  //      assert.isFalse(bbop.is_same(t4, 1), "not is_same t4c");
  //      assert.isFalse(bbop.is_same(t4, true), "not is_same t4d");
  //      assert.isFalse(bbop.is_same(t5, []), "not is_same t5a");
  //      assert.isFalse(bbop.is_same(t5, 1), "not is_same t5b");
  //      assert.isFalse(bbop.is_same(t5, ['moo']), "not is_same t5d");
  //      assert.isFalse(bbop.is_same(t5, ['moo', 'a', 'b']), "not is_same t5c");
  //      assert.isFalse(bbop.is_same(t6, {}), "not is_same t6a");
  //      assert.isFalse(bbop.is_same(t6, {'cw': 'moo'}), "not is_same t6b");
  //      assert.isFalse(bbop.is_same(t6, {'cow': 'moo', 'dog': 'arf'}),
  // 		   "not is_same t6c");
  //      assert.isFalse(bbop.is_same(t7, false), "not is_same t7a");
  //      assert.isFalse(bbop.is_same(t7, null), "not is_same t7b");
  //      assert.isFalse(bbop.is_same(t8, true), "not is_same t8a");
  //      assert.isFalse(bbop.is_same(t8, null), "not is_same t8b");

  //      // Again, apparently, harder.
  //      assert.isFalse(bbop.is_same(t9, {'a': true}),
  // 		   "not is_same t9a");
  //      assert.isFalse(bbop.is_same(t9, {'a': false}),
  // 		   "not is_same t9b");
  //      assert.isFalse(bbop.is_same(t9, {'a': true, 'b': true}),
  // 		   "not is_same t9c");
  //      assert.isFalse(bbop.is_same(t9, {'a': false, 'b': true}),
  // 		   "not is_same t9d");
  //      assert.isFalse(bbop.is_same(t9, {'a': false, 'b': false}),
  // 		   "not is_same t9e");
  //      assert.isFalse(bbop.is_same(t9, {'a': true, 'b': false, 'c': true}),
  // 		   "not is_same t9f");
  //      assert.isFalse(bbop.is_same(t9, {'a': true, 'b': false, 'c': false}),
  // 		   "not is_same t9g");

  // })();

  it("hashify", function () {
    var t0 = bbop.hashify();
    var t1 = bbop.hashify([]);
    var t2 = bbop.hashify(["a"]);
    var t3 = bbop.hashify(["a", "b", "c"]);
    var t4 = bbop.hashify([1, 2, 3]);
    var t5 = bbop.hashify([[]]);
    var t6 = bbop.hashify([
      ["a", 1],
      ["b", 2],
      ["c", 3],
    ]);

    assert.deepEqual(t0, {}, "nil is same hashified");
    assert.deepEqual(t1, {}, "[] is same hashified");
    assert.deepEqual(t2, { a: true }, "{a} is same hashified");
    assert.deepEqual(t3, { a: true, b: true, c: true }, "{a, b, c} is same hashified");
    assert.deepEqual(t4, { 1: true, 2: true, 3: true }, "{1, 2, ,3} is same hashified");
    assert.deepEqual(t5, {}, "[[]] is same hashified");
    assert.deepEqual(t6, { a: 1, b: 2, c: 3 }, "complex is same hashified");
  });

  it("is_empty", function () {
    var t1 = 1;
    var t2 = "moo";
    var t3 = [];
    var t4 = {};
    var t5 = ["moo"];
    var t6 = { cow: "moo" };
    var t7 = function () {
      return true;
    };

    assert.isFalse(bbop.is_empty(t1), "correctly empty t1");
    assert.isFalse(bbop.is_empty(t2), "correctly empty t2");
    assert.isTrue(bbop.is_empty(t3), "correctly empty t3");
    assert.isTrue(bbop.is_empty(t4), "correctly empty t4");
    assert.isFalse(bbop.is_empty(t5), "correctly empty t5");
    assert.isFalse(bbop.is_empty(t6), "correctly empty t6");
    assert.isFalse(bbop.is_empty(t7), "correctly empty t7");
  });

  it("is_defined", function () {
    var t1 = 1;
    var t2 = null;
    var t3 = [];
    var t4 = {};
    var t5 = { cow: "moo" };
    var t6 = function () {
      return true;
    };
    var t7 = true;
    var t8 = false;

    assert.isTrue(bbop.is_defined(t1), "correctly defined t1");
    assert.isTrue(bbop.is_defined(t2), "correctly defined t2");
    assert.isTrue(bbop.is_defined(t3), "correctly defined t3");
    assert.isTrue(bbop.is_defined(t4), "correctly defined t4");
    assert.isTrue(bbop.is_defined(t5), "correctly defined t5a");
    assert.isTrue(bbop.is_defined(t5["cow"]), "correctly defined t5b");
    assert.isFalse(bbop.is_defined(t5["moo"]), "correctly defined t5c");
    assert.isTrue(bbop.is_defined(t6), "correctly defined t6");
    assert.isTrue(bbop.is_defined(t7), "correctly defined t7");
    assert.isTrue(bbop.is_defined(t8), "correctly defined t8");
  });

  it("what_is", function () {
    // Simple items.
    assert.equal(bbop.what_is(), null, "nil");
    assert.equal(bbop.what_is(null), "null", "null");
    assert.equal(bbop.what_is(true), "boolean", "boolean");
    assert.equal(bbop.what_is(""), "string", "string 1");
    assert.equal(bbop.what_is("hi"), "string", "string 2");
    assert.equal(bbop.what_is(0), "number", "number 1");
    assert.equal(bbop.what_is(-1), "number", "number 2");
    assert.equal(bbop.what_is(1), "number", "number 3");
    assert.equal(bbop.what_is([]), "array", "array 1");
    assert.equal(bbop.what_is([1, 2]), "array", "array 2");
    assert.equal(bbop.what_is({}), "object", "object 1");
    assert.equal(bbop.what_is({ a: 2, b: 3 }), "object", "object 2");
    assert.equal(
      bbop.what_is(function (x) {
        return x;
      }),
      "function",
      "function",
    );

    // More complicated items.
    var foo = {};
    foo.bar = function () {
      this._is_a = "foo.bar";
    };
    var fb = new foo.bar();
    assert.equal(bbop.what_is(fb), "foo.bar", "class/object");
  });

  it("to_string", function () {
    function foo() {
      this.to_string = function () {
        return "foo!";
      };
    }

    var f = new foo();

    assert.equal(bbop.to_string(0), "0", "to_string 0");
    assert.equal(bbop.to_string("a"), "a", "to_string 1");
    assert.equal(bbop.to_string(f), "foo!", "to_string 2");
  });

  it("dump", function () {
    assert.equal(bbop.dump(), "null", "dump 0");
    assert.equal(bbop.dump(""), '""', "dump 1");
    assert.equal(bbop.dump("abc"), '"abc"', "dump 2");
    assert.equal(bbop.dump(1), "1", "dump 3");
    assert.equal(bbop.dump(null), "null", "dump 4");
    assert.equal(bbop.dump(true), "true", "dump 5");
    assert.equal(bbop.dump([]), "[]", "dump 6");
    assert.equal(bbop.dump({}), "{}", "dump 7");
    assert.equal(
      bbop.dump([null, ["bob", "bar", { foo: 1 }]]),
      '[null, ["bob", "bar", {"foo": 1}]]',
      "dump 8",
    );
  });

  it("Check hash merging", function () {
    var a_hash = { foo: 1, bar: 2 };
    assert.deepEqual({}, bbop.merge({}, {}), "empty merge");
    assert.deepEqual(a_hash, bbop.merge({ foo: 1, bar: 3 }, { bar: 2 }), "distinct merge");
    assert.deepEqual(a_hash, bbop.merge({ foo: 1, bar: 2 }, {}), "bar merge 1");
    assert.deepEqual(a_hash, bbop.merge({ foo: 1 }, { bar: 2 }), "bar merge 2");
    assert.deepEqual(a_hash, bbop.merge({}, { foo: 1, bar: 2 }), "bar merge 3");
  });

  it("Check cloning", function () {
    var foo = { a: 1, b: true, c: [1, 2, [3]], d: { one: "a", two: ["b"] } };
    var bar = bbop.clone(foo);

    // Change the original.
    foo.a = 2;
    foo.b = false;
    foo.c[2][0] = 4;
    foo.d.two[0] = "c";

    // Check the similarities.
    assert.equal(foo.c.length, bar.c.length, "array length preserved");
    assert.equal(foo.c[0], bar.c[0], "array 0 preserved");
    assert.equal(foo.d.one, bar.d.one, "hash prop preserved");

    // Check differences.
    assert.notEqual(foo.a, bar.a, "different int");
    assert.notEqual(foo.b, bar.b, "different bool");
    assert.notEqual(foo.c[2][0], bar.c[2][0], "different double index");
    assert.notEqual(foo.d.two[0], bar.d.two[0], "different in hash");
  });

  // // Check encoding ids.
  // (function(){

  //     var rounds = ["GO:1234567", "GO::GO:1234567", "::1:2::3:"];
  //     var coders = [new bbop.coder(),
  // 		  new bbop.coder({string: "_TEST_", size: 1})];

  //     // Iterate through coders and strings.
  //     for( var cdr = 0; cdr < coders.length; cdr++ ){
  // 	var coder = coders[cdr];
  // 	for( var rnd = 0; rnd < rounds.length; rnd++ ){
  // 	    var round = rounds[rnd];

  // 	    //
  // 	    var enc = coder.encode(round);
  // 	    //print(enc);
  // 	    assert.equal(round, coder.decode(enc),
  // 			      "round trip (coder: " +
  // 			      cdr + ', string: "' +
  // 			      round + '")');
  // 	}
  //     }
  // })();

  it("Check get_assemble", function () {
    var s1 = { foo: 1, bar: 2 };
    var t1 = "foo=1&bar=2";
    assert.isTrue(_link_comp(bbop.get_assemble(s1), t1), "get_assemble simple hash");

    var s2 = { foo: 1, bar: ["2", "3 4", null] };
    var t2 = "foo=1&bar=2&bar=3%204&bar=";
    assert.isTrue(_link_comp(bbop.get_assemble(s2), t2), "get_assemble hash with array");

    // I'm unsure how I feel about undefined in this case.
    var s3 = { foo: 1, bar: { bib: 2, bab: null } };
    var t3 = "foo=1&bar=bib:%222%22&bar=bab:%22%22";
    assert.isTrue(_link_comp(bbop.get_assemble(s3), t3), "get_assemble hash with hash");

    var s4 = { fq: { foo: "a", bar: ["b", '"c"'] } };
    var t4 = "fq=foo:%22a%22&fq=bar:%22b%22&fq=bar:%22c%22";
    assert.isTrue(_link_comp(bbop.get_assemble(s4), t4), "get_assemble hash with array in hash");

    // Some structures don't want more quoting.
    var s5 = { fq: { foo: "a", bar: '("c" AND "d")' } };
    var t5 = "fq=foo:%22a%22&fq=bar:(%22c%22%20AND%20%22d%22)";
    assert.isTrue(
      _link_comp(bbop.get_assemble(s5), t5),
      "get_assemble hash with some complicated structures",
    );

    // Verify that reserved characters get URL-encoded
    var s6 = {
      s1: "Ben & Jerry's",
      s2: "NAD(P)+ transhydrogenase activity",
      s3: ["ichiban", "#1"],
      s4: { email: "sam@example.com" },
    };
    var t6 =
      "s1=Ben%20%26%20Jerry's" +
      "&s2=NAD(P)%2B%20transhydrogenase%20activity" +
      "&s3=ichiban&s3=%231" +
      "&s4=email:%22sam%40example.com%22";
    assert.isTrue(
      _link_comp(bbop.get_assemble(s6), t6),
      "get_assemble hash with reserved characters",
    );
  });

  it('play with "classes" and "subclasses"', function () {
    //
    function thing1(arg) {
      // Three lexical variables.
      var lex0 = "lex0";
      var lex1 = arg + "lex1";
      var lex2 = arg + "lex2";
      var lex3 = arg + "lex3";

      // Three object variables.
      this.obj0 = "obj0";
      this.obj1 = arg + "obj1";
      this.obj2 = arg + "obj2";
      this.obj3 = arg + "obj3";

      // Three object functions accessing lexical variables.
      this.lex0_plus = function (msg) {
        return lex0 + " " + msg;
      };
      this.lex1_plus = function (msg) {
        return lex1 + " " + msg;
      };
      this.lex2_plus = function (msg) {
        return lex2 + " " + msg;
      };
      this.lex3_plus = function (msg) {
        return lex3 + " " + msg;
      };

      // Three object functions accessing object variables.
      this.obj0_plus = function (msg) {
        return this.obj0 + " " + msg;
      };
      this.obj1_plus = function (msg) {
        return this.obj1 + " " + msg;
      };
      this.obj2_plus = function (msg) {
        return this.obj2 + " " + msg;
      };
      this.obj3_plus = function (msg) {
        return this.obj3 + " " + msg;
      };
    }
    // Three prototype functions accessing object variables.
    thing1.prototype.pro0_plus = function (msg) {
      return this.obj0 + " " + msg;
    };
    thing1.prototype.pro1_plus = function (msg) {
      return this.obj1 + " " + msg;
    };
    thing1.prototype.pro2_plus = function (msg) {
      return this.obj2 + " " + msg;
    };
    thing1.prototype.pro3_plus = function (msg) {
      return this.obj3 + " " + msg;
    };

    // Now let's make a subthing.
    function subthing2(arg) {
      thing1.call(this, arg);

      this.obj2 = "OBJ2";
    }
    bbop.extend(subthing2, thing1);

    // Overrides.
    subthing2.prototype.pro1_plus = function (msg) {
      return this.obj1 + " (s2) " + msg;
    };
    subthing2.prototype.pro2_plus = function (msg) {
      return this.obj2 + " (s2) " + msg;
    };
    // Override with callback.
    subthing2.prototype.pro3_plus = function (msg) {
      thing1.prototype.pro3_plus.call(this, msg);
      return this.obj3 + " (s2+) " + msg;
    };

    // Now let's make a subthing.
    function subsubthing3(arg1, arg2) {
      subthing2.call(this, arg1);

      this.obj3 = arg2;

      this.lex3_plus = function () {
        return arg1 + " mu";
      };
    }
    bbop.extend(subsubthing3, subthing2);

    // Overrides.
    subsubthing3.prototype.pro2_plus = function (msg) {
      return this.obj2 + " (s3) " + msg;
    };
    // Override with callback.
    subsubthing3.prototype.pro3_plus = function (msg) {
      subthing2.prototype.pro3_plus.call(this, msg + " (extra)");
      return this.obj3 + " (s3+) " + msg;
    };

    ///
    /// Show that the things we made makes sense.
    ///

    var t1 = new thing1("t");
    assert.equal(t1.lex0_plus("foo"), "lex0 foo", "extend: 1");
    assert.equal(t1.lex1_plus("foo"), "tlex1 foo", "extend: 2");
    assert.equal(t1.lex2_plus("foo"), "tlex2 foo", "extend: 3");
    assert.equal(t1.lex3_plus("foo"), "tlex3 foo", "extend: 4");
    assert.equal(t1.obj0_plus("foo"), "obj0 foo", "extend: 5");
    assert.equal(t1.obj1_plus("foo"), "tobj1 foo", "extend: 6");
    assert.equal(t1.obj2_plus("foo"), "tobj2 foo", "extend: 7");
    assert.equal(t1.obj3_plus("foo"), "tobj3 foo", "extend: 8");
    assert.equal(t1.pro0_plus("foo"), "obj0 foo", "extend: 9");
    assert.equal(t1.pro1_plus("foo"), "tobj1 foo", "extend: 10");
    assert.equal(t1.pro2_plus("foo"), "tobj2 foo", "extend: 11");
    assert.equal(t1.pro3_plus("foo"), "tobj3 foo", "extend: 12");

    var s2 = new subthing2("s");
    assert.equal(s2.lex0_plus("bar"), "lex0 bar", "extend: 13");
    assert.equal(s2.lex1_plus("bar"), "slex1 bar", "extend: 14");
    assert.equal(s2.lex2_plus("bar"), "slex2 bar", "extend: 15");
    assert.equal(s2.lex3_plus("bar"), "slex3 bar", "extend: 16");
    assert.equal(s2.obj0_plus("bar"), "obj0 bar", "extend: 17");
    assert.equal(s2.obj1_plus("bar"), "sobj1 bar", "extend: 18");
    assert.equal(s2.obj2_plus("bar"), "OBJ2 bar", "extend: 19");
    assert.equal(s2.obj3_plus("bar"), "sobj3 bar", "extend: 20");
    assert.equal(s2.pro0_plus("bar"), "obj0 bar", "extend: 21");
    assert.equal(s2.pro1_plus("bar"), "sobj1 (s2) bar", "extend: 22");
    assert.equal(s2.pro2_plus("bar"), "OBJ2 (s2) bar", "extend: 23");
    assert.equal(s2.pro3_plus("bar"), "sobj3 (s2+) bar", "extend: 24");

    var s3 = new subsubthing3("S", "OBJ3");
    assert.equal(s3.lex0_plus("bib"), "lex0 bib", "extend: 25");
    assert.equal(s3.lex1_plus("bib"), "Slex1 bib", "extend: 26");
    assert.equal(s3.lex2_plus("bib"), "Slex2 bib", "extend: 27");
    assert.equal(s3.lex3_plus("bib"), "S mu", "extend: 28");
    assert.equal(s3.obj0_plus("bib"), "obj0 bib", "extend: 29");
    assert.equal(s3.obj1_plus("bib"), "Sobj1 bib", "extend: 30");
    assert.equal(s3.obj2_plus("bib"), "OBJ2 bib", "extend: 31");
    assert.equal(s3.obj3_plus("bib"), "OBJ3 bib", "extend: 32");
    assert.equal(s3.pro0_plus("bib"), "obj0 bib", "extend: 33");
    assert.equal(s3.pro1_plus("bib"), "Sobj1 (s2) bib", "extend: 34");
    assert.equal(s3.pro2_plus("bib"), "OBJ2 (s3) bib", "extend: 35");
    assert.equal(s3.pro3_plus("bib"), "OBJ3 (s3+) bib", "extend: 36");
  });

  it("first_split", function () {
    var t1 = bbop.first_split("=", "foo");
    assert.equal(t1.length, 2, "first_split: 1-1");
    assert.equal(t1[0], "", "first_split: 1-2");
    assert.equal(t1[1], "", "first_split: 1-3");

    var t2 = bbop.first_split("=", "=foo");
    assert.equal(t2.length, 2, "first_split: 2-1");
    assert.equal(t2[0], "", "first_split: 2-2");
    assert.equal(t2[1], "foo", "first_split: 2-3");

    var t3 = bbop.first_split("=", "=foo=");
    assert.equal(t3.length, 2, "first_split: 3-1");
    assert.equal(t3[0], "", "first_split: 3-2");
    assert.equal(t3[1], "foo=", "first_split: 3-3");

    var t4 = bbop.first_split("=", "foo=");
    assert.equal(t4.length, 2, "first_split: 4-1");
    assert.equal(t4[0], "foo", "first_split: 4-2");
    assert.equal(t4[1], "", "first_split: 4-3");

    var t5 = bbop.first_split("=", "fo=o");
    assert.equal(t5.length, 2, "first_split: 5-1");
    assert.equal(t5[0], "fo", "first_split: 5-2");
    assert.equal(t5[1], "o", "first_split: 5-3");

    var t6 = bbop.first_split("=", "");
    assert.equal(t6.length, 2, "first_split: 6-1");
    assert.equal(t6[0], "", "first_split: 6-2");
    assert.equal(t6[1], "", "first_split: 6-3");
  });

  it("url_parameters", function () {
    var t1 = bbop.url_parameters("asdasd?foo=bar");
    assert.equal(t1.length, 1, "urlparm: 1-1");
    assert.equal(t1[0].length, 2, "urlparm: 1-2");
    assert.equal(t1[0][0], "foo", "urlparm: 1-3");
    assert.equal(t1[0][1], "bar", "urlparm: 1-4");

    var t2 = bbop.url_parameters("asdasd?foo");
    assert.equal(t2.length, 1, "urlparm: 2-1");
    assert.equal(t2[0].length, 1, "urlparm: 2-2");
    assert.equal(t2[0][0], "foo", "urlparm: 2-3");

    var t3 = bbop.url_parameters("asdasd?foo=");
    assert.equal(t3.length, 1, "urlparm: 3-1");
    assert.equal(t3[0].length, 2, "urlparm: 3-2");
    assert.equal(t3[0][0], "foo", "urlparm: 3-3");
    assert.equal(t3[0][1], "", "urlparm: 3-4");

    var t4 = bbop.url_parameters("asdasd?foo=bar&bib=bob");
    assert.equal(t4.length, 2, "urlparm: 4-1");
    assert.equal(t4[0].length, 2, "urlparm: 4-2");
    assert.equal(t4[1].length, 2, "urlparm: 4-3");
    assert.equal(t4[0][0], "foo", "urlparm: 4-3");
    assert.equal(t4[0][1], "bar", "urlparm: 4-4");
    assert.equal(t4[1][0], "bib", "urlparm: 4-3");
    assert.equal(t4[1][1], "bob", "urlparm: 4-4");
  });

  it("sorting numbers", function () {
    var asc = [2, 3, 1];
    asc.sort(bbop.numeric_sort_ascending);
    assert.equal(asc[0], 1, "asc 1");
    assert.equal(asc[1], 2, "asc 2");
    assert.equal(asc[2], 3, "asc 3");

    var desc = [2, 3, 1];
    desc.sort(bbop.numeric_sort_descending);
    assert.equal(desc[0], 3, "desc 1");
    assert.equal(desc[1], 2, "desc 2");
    assert.equal(desc[2], 1, "desc 3");
  });

  it("Check hash folding", function () {
    // Trivial.
    assert.deepEqual({}, bbop.fold({}, {}), "empty fold");

    var a_hash = { foo: 1, bar: 2, bib: true, bab: false, bob: "" };

    // Template trivially works.
    assert.deepEqual(a_hash, bbop.fold(a_hash, {}), "same fold");

    // Two parts don't make a whole (template exclusion).
    assert.notDeepEqual(
      a_hash,
      bbop.fold({ foo: 1, bar: 2, bib: true }, { bab: false, bob: "" }),
      "partial fold",
    );

    // Proper overriding for null-ish values.
    assert.deepEqual(
      { foo: 1, bar: 2, bib: false, bab: true, bob: null },
      bbop.fold(a_hash, { foo: 1, bar: 2, bib: false, bab: true, bob: null }),
      "distinct fold",
    );
  });

  it("Check resourcify", function () {
    assert.equal(bbop.resourcify("FOO BAR", "b A b"), "foo_bar/b_a_b", "yup 1");

    assert.equal(bbop.resourcify("FOO BAR", "b A b", "BOB"), "foo_bar/b_a_b.bob", "yup 2");
  });

  it("Check dequote", function () {
    assert.equal("foo", bbop.dequote('"foo"'), "dequote 1");
    assert.equal("foo", bbop.dequote("foo"), "dequote 2");
  });

  it("Check ensure", function () {
    assert.equal(bbop.ensure("foo", '"'), '"foo"', "ensure 1");
    assert.equal(bbop.ensure("foo", '"', "front"), '"foo', "ensure 2");
    assert.equal(bbop.ensure("foo", '"', "back"), 'foo"', "ensure 3");

    assert.equal(bbop.ensure('"foo"', '"'), '"foo"', "ensure 4");
    assert.equal(bbop.ensure('"foo"', '"', "front"), '"foo"', "ensure 5");
    assert.equal(bbop.ensure('"foo"', '"', "back"), '"foo"', "ensure 6");
  });

  it("Check chomp", function () {
    assert.equal("foo", bbop.chomp("foo"), "chomp 1");
    assert.equal("foo", bbop.chomp("\tfoo  "), "chomp 2");
    assert.equal("foo", bbop.chomp("\tfoo \t "), "chomp 3");
    assert.equal("foo", bbop.chomp(" \t\nfoo \t "), "chomp 4");
  });

  it("Check splode", function () {
    // Trivial.
    var s1 = bbop.splode("foo bar");
    assert.deepEqual(["foo", "bar"], s1, "splode trivial 1");

    // Looking at empty weirdness.
    var s2 = bbop.splode(" foo bar ");
    assert.deepEqual(["", "foo", "bar", ""], s2, "splode 2");

    // Looking at empty weirdness with ';' as delimiter.
    var s3 = bbop.splode(" ; foo;bar;", ";");
    assert.deepEqual([" ", " foo", "bar", ""], s3, "splode 3");

    // Looking at more TSV.
    var s4 = bbop.splode("\t\tfoo\tbar", /\t/);
    assert.deepEqual(["", "", "foo", "bar"], s4, "splode 4");

    // Looking at multi-line files.
    var s5 = bbop.splode("foo\tbar\nbib\tbob\n", /\n/);
    assert.deepEqual(["foo\tbar", "bib\tbob", ""], s5, "splode 5");
  });

  // // Check evaluate.
  // //(function(){

  // // Trivial.
  // var e1 = bbop.evaluate('1 + 1');
  // assert.equal(e1[0], 2, 'evaluate 1a');
  // assert.equal(e1[1], "2", 'evaluate 1b');
  // assert.equal(e1[2], true, 'evaluate 1c');
  // assert.equal(e1[3], 'server', 'evaluate 1d');

  // // Change global.
  // var e2 = bbop.evaluate('var foo = 3;');
  // //assert.equal(e2[0], 2, 'evaluate 2a');
  // //assert.equal(e2[1], "2", 'evaluate 2b');
  // //assert.equal(e2[2], true, 'evaluate 2c');
  // //assert.equal(e2[3], 'server', 'evaluate 2d');
  //
  // // })();
});

describe("attempt at unit tests for logger", function () {
  it("basics", function () {
    var l1 = new bbop.logger();
    l1.DEBUG = true;
    function ll1(str) {
      return l1.kvetch(str);
    }

    // Absolute basics.
    var s1 = ll1("foo");
    assert.equal("foo", s1, "basic 1");

    var l2 = new bbop.logger("l2");
    l2.DEBUG = true;
    function ll2(str) {
      return l2.kvetch(str);
    }

    var s2 = ll2("foo");
    assert.equal("l2: foo", s2, "basic 2");
  });

  it("contexts", function () {
    var l = new bbop.logger("1");
    l.DEBUG = true;

    var t1 = l.kvetch("foo");
    assert.equal("1: foo", t1, "advanced 1");

    l.push_context("2");
    l.push_context("3");
    var t2 = l.kvetch("foo");
    assert.equal("1:2:3: foo", t2, "advanced 2");

    l.pop_context();
    var t3 = l.kvetch("foo");
    assert.equal("1:2: foo", t3, "advanced 3");

    l.reset_context();
    var t4 = l.kvetch("foo");
    assert.equal("foo", t4, "advanced 4");

    l.reset_context("a");
    var t5 = l.kvetch("foo");
    assert.equal("a: foo", t5, "advanced 5");
  });
});
