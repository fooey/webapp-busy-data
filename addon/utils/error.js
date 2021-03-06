
import Ember from 'ember';

const _error = Ember.Object.extend();

_error.reopenClass({
	normalizeAdapterError(title="ERROR", status=0, code=0, detail='') {
		status = parseInt(status, 10);

		if (code) {
			if (!status) {
				status = 400;
			}
			code = parseInt(code, 10);
		}

		return { status, title, code, detail };
	},

	parseAdapterErrors(type, status, codes, details) {
		codes = Ember.isNone(codes) ? [] : codes;
		details = Ember.isNone(details) ? [] : details;

		let errs = [];
		if (!Ember.isEmpty(codes)) {
			codes.forEach((code, idx) => {
				errs.push(this.normalizeAdapterError(type, status, code, details[idx]));
			});
		} else if (!Ember.isEmpty(details)) {
			codes.forEach((code, idx) => {
				errs.push(this.normalizeAdapterError(type, status, code, details[idx]));
			});
		} else {
			errs.push(this.normalizeAdapterError(type, status));
		}
		return errs;
	}
});

export default _error;
