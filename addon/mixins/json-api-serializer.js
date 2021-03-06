/**
 * @module Mixins
 *
 */
import Ember from 'ember';
import { UUID, Assert } from 'busy-utils';

/***/
const singleRequest = ['findRecord', 'queryRecord', 'updateRecord', 'createRecord', 'findBelongsTo'];

/**
 * `Mixins/JSONAPISerializer`
 *
 * Converts a standard api response to a json-api response
 *
 * This is a mixin that can be added to a JSONAPISerializer to
 * convert an api response to a json-api response object before
 * the normalizeResponse has started.
 *
 * @class JSONAPISerializer
 * @namespace BusyData.Mixin
 * @extends Ember.Mixin
 */
export default Ember.Mixin.create({

	/**
	 * Override of normalizeResponse in Ember Data serialize
	 *
	 * @private
	 * @method normalizeResponse
	 * @param store {Ember.Store}
	 * @param primaryModelClass {DS.Model}
	 * @param payload {object} json data
	 * @param requestType {string} ember data request type
	 * @return {object}
	 */
	normalizeResponse(store, primaryModelClass, payload, id, requestType) {
		let response;
		if (!payload.jsonapi) {
			if (requestType === 'deleteRecord') { // delete record should return a no content response
				response = {
					status: '204 No Content',
					data: null,
					jsonapi: { version: "1.0" }
				};

				if (payload.code && payload.code.length > 0) {
					response.status = '400 Bad Request';
					response.code = payload.code[0];
				}
			} else {
				response = this.convertResponse(store, primaryModelClass, payload, id, requestType);
			}
		} else {
			response = payload;
		}

		return this._super(store, primaryModelClass, response, id, requestType);
	},

	/**
	 * Converts an api response to a json-api formatted response
	 *
	 * @private
	 * @method convertResponse
	 * @param store {Ember.Store}
	 * @param primaryModelClass {DS.Model}
	 * @param payload {object} json data
	 * @param requestType {string} ember data request type
	 * @return {object}
	 */
	convertResponse(store, primaryModelClass, payload, id, requestType) {
		// get the data object or data array from the payload
		let rawData = this.getDataFromResponse(payload, requestType);
		if (singleRequest.indexOf(requestType) !== -1) {
			if(rawData.length > 1) {
				throw new Error(`${requestType} must not return more than 1 record in Model [${primaryModelClass.modelName}]`);
			}

			rawData = rawData[0] || null;
		}

		// the new json-api formatted object to return
		let json = {
			data: rawData,
			jsonapi: { version: '1.0' }
		};

		// get the meta properties as an object from the payload
		const meta = this.getMetaFromResponse(payload, requestType);
		Assert.isObject(meta);

		// add meta data
		Ember.set(json, 'meta', meta);

		if (!Ember.isNone(json.data)) {
			// create a flat json-api object
			this.flattenResponseData(store, primaryModelClass, json);
		}

		// return the resposne
		return json;
	},

	/**
	 * Gets the data from the response object. This is
	 * meant to be overriden in a sub class to provide the path
	 * to the data object in the api response.
	 *
	 * @public
	 * @method getDataFromResponse
	 * @param payload {object} api response json object
	 * @param requestType {string} ember data request type
	 * @return {object|array}
	 */
	getDataFromResponse(payload/*, requestType */) {
		return payload;
	},

	/**
	 * Gets the properties from the payload
	 * that should go into the meta object.
	 *
	 * This must be returned as an object.
	 *
	 * @public
	 * @method getMetaFromResponse
	 * @param payload {object} api response object
	 * @param requestType {string} the type of api request
	 * @return {object}
	 */
	getMetaFromResponse(/*payload, requestType*/) {
		return {};
	},

	/**
	 * method to take a nested model json structure and convert it
	 * to a json api flat json object
	 *
	 * @private
	 * @method flattenResponseData
	 * @param store {Ember.Store}
	 * @param primaryModelClass {DS.Model}
	 * @param data {object|array}
	 * @return {object}
	 */
	flattenResponseData(store, primaryModelClass, json) {
		Assert.funcNumArgs(arguments, 3, true);

		// array to track included models
		const included = [];
		const type = primaryModelClass.modelName;

		// the data object for the json-api response
		let _data;
		if(Ember.typeOf(json.data) === 'array') {
			// parse the data array objects
			_data = [];
			json.data.forEach(item => {
				_data.push(this.buildJSON(store, primaryModelClass, type, item, included));
			});
		} else {
			// parse the data object
			_data = this.buildJSON(store, primaryModelClass, type, json.data, included);
		}

		// set the included data array
		json.included = included;

		// set the data property
		json.data = _data;
	},

	/**
	 * Helper method to recursively parse the api response
	 * and convert it to a flat json-api object
	 *
	 * @private
	 * @method buildJSON
	 * @param store {Ember.Store}
	 * @param modelName {string}
	 * @param type {string} the model type
	 * @param json {object} the json object to parse
	 * @param included {array} Included property for the json-api object
	 * @return {object}
	 */
	buildJSON(store, primaryModelClass, type, json, included) {
		Assert.funcNumArgs(arguments, 5, true);
		Assert.isString(type);
		Assert.isObject(json);
		Assert.isArray(included);

		const primaryKey = Ember.get(this, 'primaryKey');

		// create a data type object
		const model = {
			id: Ember.get(json, primaryKey),
			type: this.nestedModelName(store, primaryModelClass, type),
			attributes: {},
			relationships: this.addRelationships(store, primaryModelClass, json)
		};

		// find all attributes and nested models
		for (let i in json) {
			if (json.hasOwnProperty(i)) {
				const value = Ember.get(json, i);
				// an object is going to be a nested model
				if(!Ember.isNone(value) && typeof value === 'object') {
					let obj;
					// embers typeOf will tell if the object is an array
					if (Ember.typeOf(value) === 'array') {
						// get the nested models
						obj = this.buildNestedArray(store, primaryModelClass, i, value, included);
					} else {
						if (!Ember.get(value, primaryKey)) {
							value.id = UUID.generate();
						}
						// get the nested model
						obj = this.buildNested(store, primaryModelClass, i, value, included);
					}

					// add the obj to the relationship if it exists
					if (!Ember.isEmpty(obj)) {
						// add the relationship
						Ember.set(model.relationships, i, { data: obj });
					}
				} else {
					// add the property
					Ember.set(model.attributes, i, value);
				}
			}
		}
		return model;
	},

	addRelationships(store, primaryModelClass, json) {
		const data = {};
		primaryModelClass.eachRelationship((type, opts) => {
			// get the model name + -id and underscore it.
			let name = Ember.String.underscore(`${opts.type}-id`);
			if (opts.kind === 'hasMany') {
				name = 'id';
			}

			if (opts.options.referenceKey) {
				// set the name to the referenceKey
				name = Ember.String.underscore(opts.options.referenceKey);
			}

			let key = 'id';
			if (name === 'id') {
				// if the referenceKey is id then the key should be the model name + `-id` underscored
				key = Ember.String.underscore(`${primaryModelClass.modelName}-id`);
			}

			// foreignKey overrides all other key forms if set.
			// the key order ends up as (in order of override):  id, parent_model_name_id, foreign_key
			if (opts.options.foreignKey) {
				key = opts.options.foreignKey;
			}

			// get the id from the json object if it is set
			const id = Ember.get(json, name);

			// create data object
			const relationship = {};

			// for a belongsTo relationship set the data as an object with `id` and `type`
			if (Ember.isNone(opts.options.query) && opts.kind === 'belongsTo' && key === 'id') {
				relationship.data = null;

				if (!Ember.isNone(id)) {
					// add id for data object
					relationship.data = {
						type: opts.type,
						id: id
					};
				}

				// set the data object for the relationship
				data[Ember.String.dasherize(opts.key)] = relationship;
			} else { // for a has many set the data to an empty array
				// create data object
				let link = '';
				if (!Ember.isNone(opts.options.query)) {
					if (this.validateQuery(json, opts.options.query)) {
						link += this.buildQueryParams(json, opts.options.query);

						if (opts.kind === 'belongsTo') {
							link += `&page_size=1`;
						}
					}
				}

				if (!Ember.isNone(id)) {
					// add id for data object
					key = Ember.String.underscore(key);
					link += `&${key}=${id}`;
				}

				if (!Ember.isEmpty(link)) {
					link = link.replace(/^&/, '?');
					relationship.links = { related: `/${opts.type}${link}` };
				} else {
					if (opts.kind === 'belongsTo') {
						relationship.data = null;
					} else {
						relationship.data = [];
					}
				}

				data[Ember.String.dasherize(opts.key)] = relationship;
			}
		});

		return data;
	},

	validateQuery(json, query) {
		let isvalid = true;
		Object.keys(query).forEach(key => {
			let value = Ember.get(query, key);
			if (/^self/.test(value)) {
				value = this.keyForAttribute(value.replace(/^self\./, ''));
				value = Ember.get(json, value);
				if (Ember.isNone(value)) {
					isvalid = false;
				}
			}
		});
		return isvalid;
	},

	buildQueryParams(json, query={}, str='') {
		let link = '';
		Object.keys(query).forEach(key => {
			let value = Ember.get(query, key);

			if (!Ember.isEmpty(str)) {
				key = `${str}[${key}]`;
			}

			if (Ember.isArray(value)) {
				value.forEach(val => link += `&${key}[]=${val}`);
			} else if (!Ember.isNone(value) && typeof value === 'object') {
				link += this.buildQueryParams(json, value, key);
			} else {
				if (/^self/.test(value)) {
					value = this.keyForAttribute(value.replace(/^self\./, ''));
					value = Ember.get(json, value);
				}

				link += `&${key}=${value}`;
			}
		});
		return link;
	},

	getModelReturnType(store, primaryModelClass, attr) {
		let kind = 'belongsTo';
		primaryModelClass.eachRelationship((key, opts) => {
			if (key === attr) {
				kind = opts.kind;
			}
		});

		if(kind === 'hasMany') {
			return [];
		} else {
			return null;
		}
	},

	/**
	 * Helper method to recursively parse the api response
	 * and convert it to a flat json-api object
	 *
	 * @private
	 * @method buildNested
	 * @param store {Ember.Store}
	 * @param modelName {string}
	 * @param type {string} the model type
	 * @param json {object} the json object to parse
	 * @param included {array} Included property for the json-api object
	 * @return {object}
	 */
	buildNested(store, primaryModelClass, type, json, included) {
		Assert.funcNumArgs(arguments, 5, true);
		Assert.isString(type);
		Assert.isObject(json);
		Assert.isArray(included);

		// create the actual data model
		const _data = this.buildJSON(store, primaryModelClass, type, json, included);

		// add the data model to the included array
		included.push(_data);

		// create a relationship model representation
		const model = {
			type: this.nestedModelName(store, primaryModelClass, type),
			id: _data.id
		};

		return model;
	},

	/**
	 * Helper method to recursively parse the api response
	 * and convert it to a flat json-api object
	 *
	 * @private
	 * @method buildNestedArray
	 * @param store {Ember.Store}
	 * @param modelName {string}
	 * @param type {string} the model type
	 * @param json {array} the json object to parse
	 * @param included {array} Included property for the json-api object
	 * @return {object}
	 */
	buildNestedArray(store, primaryModelClass, type, json, included) {
		Assert.funcNumArgs(arguments, 5, true);
		Assert.isString(type);
		Assert.isArray(json);
		Assert.isArray(included);

		const data = [];

		json.forEach(item => {
			// get the relationship data
			const model = this.buildNested(store, primaryModelClass, type, item, included);

			// add the relationships to the data return
			data.push(model);
		});

		// retrun the relationships
		return data;
	},

	nestedModelName(store, primaryModelClass, payloadKey) {
		if (primaryModelClass.modelName === payloadKey) {
			return payloadKey;
		} else {
			let result = payloadKey;
			primaryModelClass.eachRelationship((key, opts) => {
				if (payloadKey === key) {
					result = opts.type;
				}
			});
			return result;
		}
	}
});
