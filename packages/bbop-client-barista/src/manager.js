/*
 * Manager for handling per-model client-to-client and
 * server-to-client communication via Barista.
 *
 * Let's try and communicate with the socket.io server (Barista) for
 * messages and the like--client-to-client communication.
 *
 * There are two major categories: "relay" and "query". Relays are for
 * passing information on to other clients (e.g. "where I am");
 * queries are for asking barista information about what it might know
 * (e.g. "where is X").
 *
 * @module bbop-client-barista
 */

import bbop from "bbop-core";
import registry from "bbop-registry";
import io from "socket.io-client";

/*
 * Constructor: client
 *
 * Registry for client-to-client communication via Barista.
 */
function manager(barista_location, token) {
  registry.call(this, [
    "connect",
    "initialization",
    "relay",
    "merge",
    "rebuild",
    "message",
    "broadcast",
    "clairvoyance",
    "telekinesis",
    "query",
  ]);
  this._is_a = "bbop-client-barista";

  var anchor = this;
  anchor._token = token;
  anchor.socket = null;
  anchor.model_id = null;
  anchor.okay_p = null;

  var known_relay_classes = {
    relay: true,
    message: true,
    broadcast: true,
    merge: true,
    rebuild: true,
    clairvoyance: true,
    telekinesis: true,
  };
  var known_query_classes = {
    query: true,
  };

  var logger = new bbop.logger("barista client");
  logger.DEBUG = true;

  function ll(str) {
    if (logger.DEBUG === true) {
      logger.kvetch(str);
    }
  }

  if (typeof io === "undefined" || typeof io.connect === "undefined") {
    ll("was unable to load server.io from messaging server (io undefined)");
    anchor.okay_p = false;
  } else {
    ll("likely have the right setup--attempting");
    anchor.okay_p = true;
  }

  anchor.logger = function (bool) {
    if (typeof bool === "boolean") {
      logger.DEBUG = bool;
    }

    return logger.DEBUG;
  };

  anchor.okay = function () {
    var ret = false;
    if (anchor.okay_p) {
      ret = true;
    }
    return ret;
  };

  anchor.token = function (in_token) {
    if (in_token) {
      anchor._token = in_token;
    }
    return anchor._token;
  };

  anchor.relay = function (relay_class, data) {
    if (!anchor.okay()) {
      ll("no good socket on location; did you connect()?");
    } else {
      data.class = relay_class;
      data.model_id = anchor.model_id;
      data.token = anchor.token();

      anchor.socket.emit("relay", data);
    }
  };

  anchor.query = function (query_class, data) {
    if (!anchor.okay()) {
      ll("no good socket on location; did you connect()?");
    } else {
      ll("sending query: (" + anchor.model_id + ", " + anchor.token() + ")");

      data.class = query_class;
      data.model_id = anchor.model_id;
      data.token = anchor.token();

      anchor.socket.emit("query", data);
    }
  };

  anchor.get_layout = function () {
    anchor.query("query", { query: "layout" });
  };

  anchor.connect = function (model_id) {
    if (!anchor.okay()) {
      ll("no good socket on connect; did you connect()?");
    } else {
      anchor.socket = io.connect(barista_location);
      anchor.model_id = model_id;
      anchor.socket_id = anchor.socket.id;

      var _inject_data_with_client_info = function (data) {
        if (!data) {
          data = {};
        }

        return data;
      };

      var _applies_to_us_p = function (data) {
        var ret = false;

        var mid = data.model_id || null;
        if (!mid || mid !== anchor.model_id) {
          ll("skip packet--not for us");
        } else {
          ret = true;
        }

        return ret;
      };

      anchor.socket.on("connect", function (empty_placeholder) {
        var data = _inject_data_with_client_info(empty_placeholder);

        data.message_type = "success";
        data.message = "new client connected";
        anchor.relay("message", data);

        ll('apply "connect" callbacks');
        anchor.apply_callbacks("connect", [data]);
      });

      anchor.socket.on("initialization", function (data) {
        data = _inject_data_with_client_info(data);

        ll('apply "initialization" callbacks');
        anchor.apply_callbacks("initialization", [data]);
      });

      anchor.socket.on("relay", function (data) {
        data = _inject_data_with_client_info(data);

        var dclass = data.class;
        if (!dclass) {
          ll("no relay class found");
        } else if (!known_relay_classes[dclass]) {
          ll("unknown relay class: " + dclass);
        } else {
          if (dclass === "broadcast") {
            ll('apply (relay/bcast) "' + dclass + '" callbacks');
            anchor.apply_callbacks(dclass, [data]);
          } else if (_applies_to_us_p(data)) {
            ll('apply (relay) "' + dclass + '" callbacks');
            anchor.apply_callbacks(dclass, [data]);
          }
        }
      });

      anchor.socket.on("query", function (data) {
        data = _inject_data_with_client_info(data);

        if (_applies_to_us_p(data)) {
          var dclass = data.class;
          if (!dclass) {
            ll("no query class found");
          } else if (!known_query_classes[dclass]) {
            ll("unknown query class: " + dclass);
          } else {
            ll('apply (query) "' + dclass + '" callbacks');
            anchor.apply_callbacks(dclass, [data]);
          }
        }
      });
    }
  };

  anchor.message = function (m) {
    m.class = "message";
    anchor.relay("message", m);
  };

  anchor.broadcast = function (m) {
    m.class = "broadcast";
    anchor.relay("broadcast", m);
  };

  anchor.clairvoyance = function (top, left) {
    var packet = {
      class: "clairvoyance",
      top: top,
      left: left,
    };
    anchor.relay("clairvoyance", packet);
  };

  anchor.telekinesis = function (item_id, top, left) {
    var packet = {
      class: "telekinesis",
      objects: [
        {
          item_id: item_id,
          top: top,
          left: left,
        },
      ],
    };
    anchor.relay("telekinesis", packet);
  };
}

bbop.extend(manager, registry);

export default manager;
