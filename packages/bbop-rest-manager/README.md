# bbop-rest-manager

## Overview

The purpose of the bbop-rest-manager is simple: to create an
easy-to-use JavaScript abstraction for getting external data, usually
from REST resource, that allows code reuse across client, server, and
different response systems (promises and function callbacks).

All it needs to function is a RESTful resource to contact and a
compliant response class (see
superclass
[bbop-rest-response](https://github.com/berkeleybop/bbop-js-monorepo/tree/main/packages/bbop-rest-response)). With
this and a single change in a single line in your code, you can run it
on the server in Node, on a web client, or as a script.

The current implementation uses the Fetch API for network requests in
all supported environments.

The primary API is `start()`, which returns a standard Promise and
also triggers the registered success or error callbacks.

Compatibility aliases for the legacy `node`, `jquery`, and
`sync_request` managers are still exported, but they now share the
same asynchronous Fetch-based implementation.

`sync_request` is deprecated and no longer performs synchronous
requests.

The legacy JSONP configuration methods are still present on the
`jquery` compatibility manager for API compatibility, but they are now
no-ops and emit deprecation warnings.

For solid examples of what this does, please see
the unit tests.

## Availability

[GitHub](https://github.com/berkeleybop/bbop-js-monorepo/tree/main/packages/bbop-rest-manager)

[NPM](https://www.npmjs.com/package/bbop-rest-manager)
