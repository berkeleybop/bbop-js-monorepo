/**
 * Generic BBOP manager for dealing with basic generic REST calls.
 * This specific one is designed to be overridden by its subclasses.
 * This one pretty much just uses its incoming resource string as the data.
 * Mostly for testing purposes.
 *
 * Both a <bbop-rest-response> (or clean error data) and the manager
 * itself (this as anchor) should be passed to the callbacks.
 *
 * @module bbop-rest-manager
 */

import bbop from "bbop-core";
import us from "underscore";
import registry from "bbop-registry";

function warnDeprecated(message) {
  console.warn(message);
}

function normalizeHeaders(headerPairs) {
  return Object.fromEntries(headerPairs || []);
}

function methodWithDefault(method) {
  if (!method) {
    return "GET";
  }
  return method.toUpperCase();
}

function buildUrl(resource, payload, method) {
  if (method !== "GET" || us.isEmpty(payload)) {
    return resource;
  }

  var url = new URL(resource);
  var params = new URLSearchParams(url.search);
  Object.entries(payload).forEach(function ([key, value]) {
    if (Array.isArray(value)) {
      value.forEach(function (item) {
        params.append(key, item);
      });
    } else if (typeof value !== "undefined" && value !== null) {
      params.append(key, value);
    }
  });
  url.search = params.toString();
  return url.toString();
}

function buildRequestInit(payload, method, headers) {
  var requestHeaders = normalizeHeaders(headers);
  var init = {
    method: method,
    headers: requestHeaders,
  };

  if (method === "GET") {
    return init;
  }

  if (!us.isEmpty(payload)) {
    var body = new URLSearchParams();
    Object.entries(payload).forEach(function ([key, value]) {
      if (Array.isArray(value)) {
        value.forEach(function (item) {
          body.append(key, item);
        });
      } else if (typeof value !== "undefined" && value !== null) {
        body.append(key, value);
      }
    });
    if (
      !Object.keys(requestHeaders).some(function (header) {
        return header.toLowerCase() === "content-type";
      })
    ) {
      requestHeaders["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    }
    init.body = body;
  }

  return init;
}

function normalizeErrorMessage(error) {
  if (!error) {
    return "unknown fetch error";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Contructor for the REST manager.
 *
 * See also: module:bbop-registry
 *
 * @constructor
 * @param {Object} response_handler - the response handler class to use for each call
 * @returns {Object} rest manager object
 */
function manager_base(response_handler) {
  registry.call(this, ["success", "error"]);
  this._is_a = "bbop-rest-manager.base";

  var anchor = this;

  this._logger = new bbop.logger(this._is_a);
  this._logger.DEBUG = false;
  function ll(str) {
    anchor._logger.kvetch(str);
  }

  this._response_handler = response_handler;
  this._qurl = null;
  this._qpayload = {};
  this._qmethod = "GET";
  this._headers = [];
  this._safety = false;

  this.debug = function (p) {
    if (p === true || p === false) {
      this._logger.DEBUG = p;
    }
    return this._logger.DEBUG;
  };

  this._ensure_arguments = function (url, payload, method, headers) {
    ll("ensure arguments...");

    if (typeof url !== "undefined") {
      this.resource(url);
    }
    if (typeof payload !== "undefined") {
      this.payload(payload);
    }
    if (typeof method !== "undefined") {
      this.method(method);
    }
    if (typeof headers !== "undefined") {
      this.headers(headers);
    }

    if (!this.resource()) {
      throw new Error("must have resource defined");
    }
  };

  this._apply_callbacks_by_response = function (response) {
    ll("apply callbacks by response...");

    if (response && response.okay()) {
      anchor.apply_callbacks("success", [response, anchor]);
    } else {
      anchor.apply_callbacks("error", [response, anchor]);
    }
  };

  this.resource = function (in_url) {
    ll("resource called with: " + in_url);

    if (typeof in_url !== "undefined" && bbop.what_is(in_url) === "string") {
      anchor._qurl = in_url;
    }
    return anchor._qurl;
  };

  this.payload = function (payload) {
    ll("payload called with: " + payload);

    if (bbop.is_defined(payload) && bbop.what_is(payload) === "object") {
      anchor._qpayload = payload;
    }
    return bbop.clone(anchor._qpayload);
  };

  this.method = function (method) {
    ll("method called with: " + method);

    if (bbop.is_defined(method) && bbop.what_is(method) === "string") {
      anchor._qmethod = methodWithDefault(method);
    }
    return anchor._qmethod;
  };

  this.headers = function (in_headers) {
    ll("headers called with: " + in_headers);

    if (in_headers && us.isArray(in_headers)) {
      anchor._headers = in_headers;
    }
    return anchor._headers;
  };

  this.run_promise_functions = async function (
    promise_function_stack,
    accumulator_function,
    final_function,
    error_function,
  ) {
    var initialCount = promise_function_stack.length || 0;
    while (!us.isEmpty(promise_function_stack)) {
      var promise_runner = promise_function_stack.shift();
      try {
        var resp = await promise_runner();
        accumulator_function(resp, anchor);
      } catch (err) {
        if (err) {
          error_function(err, anchor);
        }
        return initialCount;
      }
    }
    final_function(anchor);
    return initialCount;
  };
}
bbop.extend(manager_base, registry);

manager_base.prototype.fetch = function (url, payload, method, headers) {
  var anchor = this;
  anchor._logger.kvetch("called fetch");

  this._ensure_arguments(url, payload, method, headers);

  var response = new this._response_handler(this.payload());
  response.okay(true);
  response.message("empty");
  response.message_type("success");

  this._apply_callbacks_by_response(response);

  return response;
};

manager_base.prototype.start = function (url, payload, method, headers) {
  this._ensure_arguments(url, payload, method, headers);

  var response = new this._response_handler(this.payload());
  response.okay(true);
  response.message("empty");
  response.message_type("success");

  this._apply_callbacks_by_response(response);

  return Promise.resolve(response);
};

var manager_fetch = function (response_handler) {
  manager_base.call(this, response_handler);
  this._is_a = "bbop-rest-manager.fetch";
};
bbop.extend(manager_fetch, manager_base);

manager_fetch.prototype.fetch = function (url, payload, method, headers) {
  this._logger.kvetch("called fetch");
  this.start(url, payload, method, headers);
  return null;
};

manager_fetch.prototype.start = async function (url, payload, method, headers) {
  var anchor = this;

  this._ensure_arguments(url, payload, method, headers);

  var requestMethod = methodWithDefault(anchor.method());
  var requestUrl = buildUrl(anchor.resource(), anchor.payload(), requestMethod);
  var requestInit = buildRequestInit(anchor.payload(), requestMethod, anchor.headers());

  try {
    var fetchResponse = await fetch(requestUrl, requestInit);
    var rawText = await fetchResponse.text();
    var response = new anchor._response_handler(rawText);

    if (fetchResponse.ok && response && response.okay()) {
      anchor.apply_callbacks("success", [response, anchor]);
      return response;
    }

    if (!response) {
      response = new anchor._response_handler(null);
    }
    response.okay(false);
    response.message_type("error");
    if (!rawText) {
      response.message(`HTTP ${fetchResponse.status}`);
    } else if (fetchResponse.ok) {
      response.message("bad response");
    } else {
      response.message(`HTTP ${fetchResponse.status}`);
    }
    anchor.apply_callbacks("error", [response, anchor]);
    return response;
  } catch (error) {
    var errorResponse = new anchor._response_handler(null);
    errorResponse.okay(false);
    errorResponse.message(normalizeErrorMessage(error));
    errorResponse.message_type("error");
    anchor.apply_callbacks("error", [errorResponse, anchor]);
    return errorResponse;
  }
};

var manager_node = function (response_handler) {
  manager_fetch.call(this, response_handler);
  this._is_a = "bbop-rest-manager.node";
};
bbop.extend(manager_node, manager_fetch);

var manager_sync_request = function (response_handler) {
  manager_fetch.call(this, response_handler);
  this._is_a = "bbop-rest-manager.sync_request";
};
bbop.extend(manager_sync_request, manager_fetch);

manager_sync_request.prototype.fetch = function (url, payload, method, headers) {
  warnDeprecated(
    "bbop-rest-manager.sync_request is deprecated; requests are now asynchronous and fetch() returns null. Use start() instead.",
  );
  this._logger.kvetch("called fetch");
  manager_fetch.prototype.start.call(this, url, payload, method, headers);
  return null;
};

manager_sync_request.prototype.start = function (url, payload, method, headers) {
  warnDeprecated(
    "bbop-rest-manager.sync_request is deprecated; requests are now asynchronous. Use start() as a promise-based API.",
  );
  return manager_fetch.prototype.start.call(this, url, payload, method, headers);
};

var manager_jquery = function (response_handler) {
  manager_fetch.call(this, response_handler);
  this._is_a = "bbop-rest-manager.jquery";
  this._use_jsonp = false;
  this._jsonp_callback = "json.wrf";
};
bbop.extend(manager_jquery, manager_fetch);

manager_jquery.prototype.use_jsonp = function (use_p) {
  if (typeof use_p !== "undefined") {
    warnDeprecated(
      "bbop-rest-manager.jquery JSONP support has been removed; use_jsonp() is now a no-op.",
    );
  }
  return this._use_jsonp;
};

manager_jquery.prototype.jsonp_callback = function (cstring) {
  if (typeof cstring !== "undefined") {
    warnDeprecated(
      "bbop-rest-manager.jquery JSONP support has been removed; jsonp_callback() is now a no-op.",
    );
  }
  return this._jsonp_callback;
};

export default {
  base: manager_base,
  node: manager_node,
  sync_request: manager_sync_request,
  jquery: manager_jquery,
};
