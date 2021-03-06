/**
 * @module Mixins
 *
 */
import Ember from 'ember';
import DataAdapterMixin from 'ember-simple-auth/mixins/data-adapter-mixin';

const { assert, isPresent } = Ember;

export default Ember.Mixin.create(DataAdapterMixin, {
  /**
	 * Overrides ember simple auth to support ds-improved-ajax calls
	 *
	 * Defines a `beforeSend` hook (see http://api.jquery.com/jQuery.ajax/) that
	 * injects a request header containing the authorization data as constructed
	 * by the {{#crossLink "DataAdapterMixin/authorizer:property"}}{{/crossLink}}
	 * (see {{#crossLink "SessionService/authorize:method"}}{{/crossLink}}). The
	 * specific header name and contents depend on the actual authorizer that is
	 * used.
	 *
	 * Until [emberjs/rfcs#171](https://github.com/emberjs/rfcs/pull/171)
	 * gets resolved and [ds-improved-ajax](https://github.com/emberjs/data/pull/3099)
	 * [feature flag](https://github.com/emberjs/data/blob/master/FEATURES.md#feature-flags)
	 * is enabled, this method will be called for **every** ember-data version.
	 * `headersForRequest` *should* replace it after the resolution of the RFC.
	 *
	 * @method headersForRequest
	 * @protected
	 */
	_requestToJQueryAjaxHash(request) {
    const authorizer = this.get('authorizer');
    assert("You're using the DataAdapterMixin without specifying an authorizer. Please add `authorizer: 'authorizer:application'` to your adapter.", isPresent(authorizer));

		let hash = this._super(request);
    let { beforeSend } = hash;

    hash.beforeSend = (xhr) => {
      this.get('session').authorize(authorizer, (headerName, headerValue) => {
        xhr.setRequestHeader(headerName, headerValue);
      });

      if (beforeSend) {
        beforeSend(xhr);
      }
    };

		return hash;
	}
});
