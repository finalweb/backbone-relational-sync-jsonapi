(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', 'backbone', 'underscore'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('backbone'), require('underscore'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.backbone, global.underscore);
    global.backboneSyncJsonapi = mod.exports;
  }
})(this, function (exports, _backbone, _underscore) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  exports.default = function (Backbone, _) {
    //make sure we have everything we need.
    Backbone = Backbone || _backbone2.default;
    _ = _ || _underscore2.default;

    var oldHasChanged = Backbone.Model.prototype.hasChanged;
    /**
     * Override Model.hasChanged to allow checking if any of the model's
     * immediate relations have changed.
     *
     * @param attr
     * @param opts
     * @returns {boolean}
     */
    Backbone.Model.prototype.hasChanged = function (attr, opts) {
      var relsChanged = false;
      if (attr && (typeof attr === 'boolean' || (typeof attr === 'undefined' ? 'undefined' : _typeof(attr)) === 'object')) {
        opts = attr;
        relsChanged = this.relationsHaveChanged(opts);
      }

      if (relsChanged) {
        return true;
      } else {
        if (typeof attr !== 'string') {
          delete arguments[0];
          delete arguments[1];
        }
        return oldHasChanged.apply(this, arguments);
      }
    };

    /**
     * Add hasChanged function for collection. Loops through all objects to see if
     * any items in them have changed.
     *
     * @returns {boolean}
     */
    Backbone.Collection.prototype.hasChanged = function () {
      var colHasChanged = false;
      this.each(function (obj) {
        if (obj.hasChanged()) {
          colHasChanged = true;
        }
      });
      return colHasChanged;
    };

    /**
     * Check if any immediate relations have changed.
     *
     * @param relations
     * @returns {boolean}
     */
    Backbone.Model.prototype.relationsHaveChanged = function (relations) {
      var self = this,
          resp = false,
          relations = (typeof relations === 'undefined' ? 'undefined' : _typeof(relations)) === 'object' ? relations : this._relations;
      _.each(relations, function (relation) {
        if ((typeof relation === 'undefined' ? 'undefined' : _typeof(relation)) === 'object') {
          relation = relation.key;
        }
        var rel = self.get(relation);
        if (rel && rel.hasChanged()) {
          resp = true;
        }
      });
      return resp;
    };

    /**
     * Get any relations that have changed.
     *
     * @param options
     * @returns {{}}
     */
    Backbone.Model.prototype.getChangedRelations = function (options) {
      var opts = _.extend({
        collection: 'Backbone.Collection'
      }, options);
      var data = {},
          model = this;

      _.each(model.syncRelations, function (item) {
        var rel = model.get(item);
        if (rel) {
          if (rel instanceof Backbone.Collection) {
            rel.each(function (r) {
              if (r.hasChanged()) {
                if (!data[item]) {
                  data[item] = new rel.constructor();
                }
                data[item].add(r);
              }
            });
          } else {
            if (rel.hasChanged()) {
              if (!data[item]) {
                data[item] = new (window[opts.collection].extend({
                  model: rel.constructor
                }))();
              }
              data[item].add(rel);
            }
          }
        }
      });
      return data;
    };

    /**
     * Adds the ability to have an excludeFromJSON attribute on our models
     */
    var oldToJSON = Backbone.Model.prototype.toJSON;
    Backbone.Model.prototype.toJSON = function () {
      var json = oldToJSON.apply(this, arguments),
          excludeFromJSON = this.excludeFromJSON;
      if (excludeFromJSON) {
        _.each(excludeFromJSON, function (key) {
          delete json[key];
        });
      }
      return json;
    };

    /**
     * Override Backbone.sync so we can include two options
     *
     * options.withRelations //a boolean specifying whether to send the relations in the same post request as 'relations' in the data attribute
     * options.relations //an array of which relations to save to their own API entry points,
     * otherwise if a model has model.syncRelations specified, that will be processed instead.
     *
     * @param method
     * @param model
     * @param options
     * @returns {*}
     */
    Backbone.sync = function (method, model, options) {
      var type = methodMap[method];

      // Default options, unless specified.
      _.defaults(options || (options = {}), {
        emulateHTTP: Backbone.emulateHTTP,
        emulateJSON: Backbone.emulateJSON
      });

      // Default JSON-request options.
      var params = { type: type, dataType: 'json' };

      // Ensure that we have a URL.
      if (!options.url) {
        params.url = _.result(model, 'url') || urlError();
      }

      // Ensure that we have the appropriate request data.
      if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
        params.contentType = 'application/json';

        var myData = {
          data: {}
        };
        myData.data.type = model.constructor.prototype.defaults.type;

        /**
         * Set the ID for the request
         */
        if (model.get(model.idAttribute)) {
          myData.data[model.idAttribute] = model.get(model.idAttribute);
        }
        myData.data.attributes = options.attrs || model.toJSON(options);
        delete myData.data.attributes[model.idAttribute];

        //remove the relations from the request if the user doesn't want to send them
        if (!options.withRelations) {
          var array = model.getRelations();
          for (var i = 0; i < array.length; i++) {
            delete myData.data.attributes[array[i].key];
          }
        } else {}
        //TODO: need to implement what to do when relations are included in a single post


        /**
         * If the models have specified any specific relations to be synced,
         * we need to sync those
         */
        var syncRelations = options.relations || model.syncRelations;
        if (syncRelations) {
          for (var _i = 0; _i < syncRelations.length; _i++) {
            var rel = model.get(syncRelations[_i]);
            if ((typeof rel === 'undefined' ? 'undefined' : _typeof(rel)) === 'object' && rel.hasChanged()) {
              rel.save();
            }
          }
        }

        /**
         * We need to remove the type attribute since it's just the default.
         */
        delete myData.data.attributes.type;

        params.data = JSON.stringify(myData);
      }

      // For older servers, emulate JSON by encoding the request into an HTML-form.
      if (options.emulateJSON) {
        params.contentType = 'application/x-www-form-urlencoded';
        params.data = params.data ? { model: params.data } : {};
      }

      // For older servers, emulate HTTP by mimicking the HTTP method with `_method`
      // And an `X-HTTP-Method-Override` header.
      if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
        params.type = 'POST';
        if (options.emulateJSON) params.data._method = type;
        var beforeSend = options.beforeSend;
        options.beforeSend = function (xhr) {
          xhr.setRequestHeader('X-HTTP-Method-Override', type);
          if (beforeSend) return beforeSend.apply(this, arguments);
        };
      }

      // Don't process data on a non-GET request.
      if (params.type !== 'GET' && !options.emulateJSON) {
        params.processData = false;
      }

      // Pass along `textStatus` and `errorThrown` from jQuery.
      var error = options.error;
      options.error = function (xhr, textStatus, errorThrown) {
        options.textStatus = textStatus;
        options.errorThrown = errorThrown;
        if (error) error.call(options.context, xhr, textStatus, errorThrown);
      };

      // Make the request, allowing the user to override any Ajax options.
      var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
      model.trigger('request', model, xhr, options);

      return xhr;
    };

    // Map from CRUD to HTTP for our default `Backbone.sync` implementation.
    var methodMap = {
      'create': 'POST',
      'update': 'PUT',
      'patch': 'PATCH',
      'delete': 'DELETE',
      'read': 'GET'
    };

    return Backbone;
  };

  var _backbone2 = _interopRequireDefault(_backbone);

  var _underscore2 = _interopRequireDefault(_underscore);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
      default: obj
    };
  }

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  ;
});