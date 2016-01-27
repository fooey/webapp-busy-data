/**
 * @module app/initializers
 *
 */
//import Ember from 'ember';
import DS from 'ember-data';
import ENV from '../config/environment';
import Configuration from 'busy-data/configuration';
//import setupAuth from 'busy-data/initializers/setup-auth';

export default {
	name: 'busy-data',

	initialize: function(/*registry*/)
	{
		const config = ENV.APP || {};
			  config.baseURL = ENV.baseURL;
			  config.modulePrefix = ENV.modulePrefix;

		// load busy-data config options
		Configuration.load(config);

		DS.Model.reopen(
		{
			getRecord: function()
			{
				// fix for the model._internalModel issue.
				return this._internalModel.getRecord();
			},

			saveBatch: function(auto)
			{
				this._batch = true;
				this._autoBatch = auto === true ? true : false;
				return this.save();
			},
		});

	//	setupAuth(registry);
	}
};
