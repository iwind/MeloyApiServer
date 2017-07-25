window.Tea = {};

/**
 * 定义Tea.View对象
 */
window.Tea.View = new function () {
	var that = this;

	this.scopeTryTimes = 100;
	this.$scope = null;
	this.$http = null;
	this.$httpParamSerializer = null;
	this.$compile = null;
	this.$templateRequest = null;

	this.init = function () {
		//初始化app
		var app = angular.module("app", []);
		app.controller("controller", function ($scope, $http, $httpParamSerializer, $compile, $templateRequest) {
			that.$scope = $scope;
			that.$http = $http;
			that.$httpParamSerializer = $httpParamSerializer;
			that.$compile = $compile;
			that.$templateRequest = $templateRequest;

			$scope.Tea = window.Tea;

			for (var key in TEA.ACTION.data) {
				if (TEA.ACTION.data.hasOwnProperty(key)) {
					$scope[key] = TEA.ACTION.data[key];
				}
			}
		})
		.filter("allow", ["$sce", function($sce){
			return function(text) {
				return $sce.trustAsHtml(text);
			};
		}])
		.filter("pretty", function(){
			return function(text) {
				return angular.toJson(text, true);
			};
		});

		//支持data-tea-action
		angular.element(window).bind("load", function () {
			Tea.activate(document.body);
		});
	};

	this.update = function () {
		if (this.$scope == null) {
			return;
		}
		setTimeout(function () {
			that.$scope.$apply();
		}, 0);
	};

	this.scope = function (fn) {
		var that = this;
		if (!this.$scope) {
			if (this.scopeTryTimes < 0) {
				return;
			}
			this.scopeTryTimes --;
			setTimeout(function () {
				that.scope(fn);
			}, 1);
			return;
		}

		if (typeof(fn) == "function") {
			fn.call(this.$scope);
			for (var key in this.$scope) {
				if (!this.$scope.hasOwnProperty(key) || !angular.isFunction(this.$scope[key]) || key.substr(0, 1) == "$") {
					continue;
				}

				//执行初始化
				if (key.match(/^_init/)) {
					(function (prop) {
						setTimeout(function () {
							prop.apply(that.$scope);
						}, 0);
					})(this.$scope[key]);
					continue;
				}

				(function (prop) {
					that.$scope[key] = function () {
						return prop.apply(that.$scope, arguments);
					};
				})(this.$scope[key]);
			}

			this.$scope.$apply();
		}
	};

	this.init();
};

/**
 * 定义Action对象
 *
 * @param action Action
 * @param params 参数集
 * @constructor
 */
window.Tea.Action = function (action, params) {
	var _action = action;
	var _params = params;
	var _successFn;
	var _failFn;
	var _errorFn;
	var _method = "POST";
	var _timeout = 30;
	var _delay = 0;

	this.params = function (params) {
		_params = params;
		return this;
	};

	this.form = function (form) {
		_params = new FormData(form);
		return this;
	};

	this.success = function (successFn) {
		_successFn = successFn;
		return this;
	};

	this.fail = function (failFn) {
		_failFn = failFn;
		return this;
	};

	this.error = function (errorFn) {
		_errorFn = errorFn;
		return this;
	};

	this.timeout = function (timeout) {
		_timeout = timeout;
		return this;
	};

	this.delay = function (delay) {
		_delay = delay;
		return this;
	};

	this.post = function () {
		setTimeout(this._post, 0);

		return this;
	};

	this._post = function () {
		_method = "POST";

		var params = _params;
		var contentType;
		if (!(_params instanceof FormData)) {
			params = Tea.serialize(params);
			contentType = "application/x-www-form-urlencoded";
		}
		Tea.View.$http({
			method: _method,
			url: Tea.url(_action),
			timeout: _timeout * 1000,
			data: params,
			headers: {
				"Content-Type": contentType,
				"X-Requested-With": "XMLHttpRequest"
			}
		})
		.success(function (response) {
			setTimeout(function () {
				//回调
				if (response.code != 200) {
					if (typeof(_failFn) == "function") {
						_failFn.call(Tea.View.$scope, response);
						Tea.View.update();
					}
					else {
						//消息提示
						var hasMessage = false;
						if (response.message != null && response.message.length > 0) {
							hasMessage = true;
							alert(response.message);
						}
						if (typeof(response.errors) == "object" && response.errors.length > 0) {
							var error = response.errors[0][0]; // [field, rule, message]
							if (!hasMessage) {
								alert(error[2]);
							}
							var fieldName = error[0];
							var element = document.querySelector("*[name='" + fieldName + "']");
							if (element) {
								element.focus();
							}
							else {
								var match = fieldName.match(/^(.+)\[(\d+)\]$/);
								if (match != null) {
									var index = parseInt(match[2], 10);
									var fields = document.querySelectorAll("*[name='" + match[1].trim() + "[]']");
									if (fields.length >0 && index < fields.length) {
										fields[index].focus();
									}
								}
							}
						}
					}
				}
				else {
					if (typeof(_successFn) == "function") {
						_successFn.call(Tea.View.$scope, response);
						Tea.View.update();
					}
					else {
						if (response.message != null && response.message.length > 0) {
							alert(response.message);
						}
						if (response.next != null && typeof(response.next) == "object") {
							if (response.next.action == "*refresh") {
								window.location.reload();
							}
							else {
								Tea.go(response.next.action, response.next.params, response.next.hash);
							}
						}
					}
				}
			}, _delay * 1000);
		})
		.error(function (response) {
			if (typeof(_errorFn) == "function") {
				_errorFn.call(Tea.View.$scope, response);
				Tea.View.update();
			}
		});

		return this;
	};
};

/**
 * 取得Action对象
 *
 * @param action Action
 * @returns {Window.Tea.Action}
 */
window.Tea.action = function (action) {
	return new this.Action(action);
};

/**
 *
 * 发送POST请求
 *
 * @param action
 * @param params
 * @param successFn
 * @param failFn
 * @returns {Window.Tea.Action}
 */
window.Tea.post = function (action, params, successFn, failFn) {
	return Tea.action(action)
		.params(params)
		.success(successFn)
		.fail(failFn)
		.post();
};

/**
 * 激活元素中的Action
 *
 * 支持
 * - data-tea-action
 * - data-tea-confirm
 * - data-tea-timeout
 * - data-tea-before
 * - data-tea-success
 * - data-tea-fail
 * - data-tea-error
 */
window.Tea.activate = function (element) {
	var nodes = element.querySelectorAll("*[data-tea-action]");
	if (nodes.length == 0) {
		return;
	}
	for (var i = 0; i < nodes.length; i ++) {
		var node = nodes[i];

		if (node.tagName.toUpperCase() == "FORM") {
			angular.element(node).unbind("submit").bind("submit", function (e) {
				Tea.runActionOn(this);

				e.preventDefault();
				e.stopPropagation();
			});
		}
		else {
			angular.element(node).unbind("click").bind("click", function (e) {
				Tea.runActionOn(this);

				e.preventDefault();
				e.stopPropagation();

				return false;
			});
		}
	}
};

/**
 * 执行绑定data-tea-*的元素
 *
 * @param element 元素
 */
window.Tea.runActionOn = function (element) {
	var form = angular.element(element);
	var action = form.attr("data-tea-action");
	var timeout = form.attr("data-tea-timeout");
	var confirm = form.attr("data-tea-confirm");
	var beforeFn = form.attr("data-tea-before");
	var successFn = form.attr("data-tea-success");
	var failFn = form.attr("data-tea-fail");
	var errorFn = form.attr("data-tea-error");
	if (confirm != null && confirm.length > 0 && !window.confirm(confirm)) {
		return;
	}

	//执行前调用beforeFn
	if (beforeFn != null && beforeFn.length > 0) {
		beforeFn = beforeFn.split("(")[0].trim();
		if (typeof(Tea.View.$scope[beforeFn]) == "function") {
			var result = Tea.View.$scope[beforeFn].call(Tea.View.$scope, form);
			Tea.View.update();
			if (typeof(result) == "boolean" && !result) {
				return;
			}
		}
	}

	//请求对象
	var actionObject = Tea.action(action)
		.success(function (response) {
			if (successFn != null && successFn.length > 0) {
				successFn = successFn.split("(")[0].trim();
				if (typeof(Tea.View.$scope[successFn]) == "undefined") {
					throw new Error("unable to find callback '" + successFn + "'");
				}
				var result = Tea.View.$scope[successFn].call(Tea.View.$scope, response);
				Tea.View.update();
				if (typeof(result) == "boolean" && !result) {
					return;
				}
			}
			if (response.message != null && response.message.length > 0) {
				alert(response.message);
			}
			if (response.next != null && typeof(response.next) == "object") {
				if (response.next.action == "*refresh") {
					window.location.reload();
				}
				else {
					Tea.go(response.next.action, response.next.params, response.next.hash);
				}
			}
		})
		.fail(function (response) {
			//回调
			if (failFn != null && failFn.length > 0) {
				failFn = failFn.split("(")[0].trim();
				if (typeof(Tea.View.$scope[failFn]) == "undefined") {
					throw new Error("unable to find callback '" + failFn + "'");
				}
				var result = Tea.View.$scope[failFn].call(Tea.View.$scope, response);
				Tea.View.update();
				if (typeof(result) == "boolean" && !result) {
					return;
				}
			}

			//消息提示
			var hasMessage = false;
			if (response.message != null && response.message.length > 0) {
				hasMessage = true;
				alert(response.message);
			}
			if (typeof(response.errors) == "object" && response.errors.length > 0) {
				var error = response.errors[0][0]; // [field, rule, message]
				if (!hasMessage) {
					alert(error[2]);
				}
				var fieldName = error[0];
				var element = document.querySelector("*[name='" + fieldName + "']");
				if (element) {
					element.focus();
				}
				else {
					var match = fieldName.match(/^(.+)\[(\d+)\]$/);
					if (match != null) {
						var index = parseInt(match[2], 10);
						var fields = document.querySelectorAll("*[name='" + match[1].trim() + "[]']");
						if (fields.length >0 && index < fields.length) {
							fields[index].focus();
						}
					}
				}
			}
		})
		.error(function () {
			if (errorFn != null && errorFn.length > 0) {
				errorFn = errorFn.split("(")[0].trim();
				if (typeof(Tea.View.$scope[errorFn]) == "undefined") {
					throw new Error("unable to find callback '" + errorFn + "'");
				}
				var result = Tea.View.$scope[errorFn].call(Tea.View.$scope);
				Tea.View.update();
				if (typeof(result) == "boolean" && !result) {
					return;
				}
			}
		})
		.post();

	//超时时间
	if (timeout != null) {
		timeout = parseFloat(timeout);
		if (!isNaN(timeout)) {
			actionObject.timeout(timeout);
		}
	}

	//参数
	if (element.tagName.toUpperCase() == "FORM") {
		actionObject.form(element);
	}
	else {
		var attributes = element.attributes;
		var params = {};
		for (var i = 0; i < attributes.length; i ++) {
			var attr = attributes[i];
			var match = attr.name.toString().match(/^data-(.+)$/);
			if (match && !match[1].match(/^tea-/)) {
				var pieces = match[1].split("-");
				for (var j = 1; j < pieces.length; j ++) {
					pieces[j] = pieces[j][0].toUpperCase() + pieces[j].substr(1);
				}
				var name = pieces.join("");
				params[name] = attr.value;
			}
		}
		actionObject.params(params);
	}
};

/**
 * 序列化参数为可传递的字符串
 *
 * @param params 要序列化的参数集
 * @returns {*}
 */
window.Tea.serialize = function (params) {
	return Tea.View.$httpParamSerializer(params);
};

/**
 * 取得Action对应的URL
 *
 * @param action Action
 * @param params 参数
 * @param hashParams 锚点参数
 * @returns {*}
 */
window.Tea.url = function (action, params, hashParams) {
	var config = window.TEA.ACTION;
	var controller = config.parent;
	var module = config.module;
	var base = config.base;
	var actionParam = config.actionParam;

	var url = "";
	if (action.match(/\//)) {//支持URL
		url = action;

		if (typeof(params) == "object") {
			var query = Tea.serialize(params);
			if (query.length > 0) {
				url += "?" + query;
			}
		}
		if (!url.match(/^(http|https|ftp):/i)) {
			url = base + ((url.substr(0, 1) == "/") ? "" : "/") + url;
		}
	}
	else {
		if (action.substr(0, 2) === "..") {
			var pos = controller.lastIndexOf(".");
			if (pos === -1) {
				action = action.substr(2);
			}
			else {
				action = controller.substr(0, pos) + action.substr(1);
			}
			if (module != "") {
				action = "@" + module + "." + action;
			}
		}
		else if (action.substr(0, 1) == ".") {
			action = controller + action;
			if (module != "") {
				action = "@" + module + "." + action;
			}
		}
		else if (module != "") {
			if (action == "@") {
				action = "@" + module;
			}
			else {
				action = action.replace("@.", "@" + module + ".");
			}
		}
		if (actionParam) {
			var path = action.replace(/[.\/]+/g, "/");
			if (path.substr(0, 1) != "/") {
				path = "/" + path;
			}
			url = base + "?__ACTION__=" + path;
		}
		else {
			url = base + "/" + action.replace(/[.\/]+/g, "/").replace(/^\//, "");
		}
		if (typeof(params) == "object") {
			params = Tea.serialize(params);
			if (params.length > 0) {
				if (url.indexOf("?") == -1) {
					url += "?" + params;
				}
				else {
					url += "&" + params;
				}
			}
		}
		if (typeof(hashParams) == "string") {
			url += "#" + hashParams;
		}
		else if (typeof(hashParams) == "object") {
			url += "#" + Tea.serialize(hashParams);
		}
	}
	return url;
};

/**
 * 跳转
 *
 * @param action 要跳转到的action
 * @param params 附带的参数
 * @param hash 附带的锚点参数
 */
window.Tea.go = function (action, params, hash) {
	var url = Tea.url(action, params);
	if (hash && hash.length > 0) {
		url += "#" + hash;
	}
	window.location.href = url;
};

/**
 * 格式化字节数
 *
 * @param bytes 字节数
 * @returns {*}
 */
window.Tea.formatBytes = function (bytes) {
	if (bytes < 1024) {
		return "< 1kb";
	}
	else if (bytes < 1024 * 1024) {
		return Math.round(bytes / 1024 * 100) / 100 + " kb";
	}
	else if (bytes < 1024 * 1024 * 1024) {
		return Math.round(bytes / 1024 / 1024 * 100) / 100 + " mb";
	}
	return Math.round(bytes / 1024 / 1024 / 1024 * 100) / 100+ " gb";
};

/**
 * 版本号对比
 *
 * 代码来自 http://stackoverflow.com/questions/6832596/how-to-compare-software-version-number-using-js-only-number
 *
 * @param a
 * @param b
 * @returns {number}
 */
window.Tea.versionCompare = function compare(a, b) {
	if (a === b) {
		return 0;
	}

	var a_components = a.split(".");
	var b_components = b.split(".");

	var len = Math.min(a_components.length, b_components.length);

	// loop while the components are equal
	for (var i = 0; i < len; i++) {
		// A bigger than B
		if (parseInt(a_components[i]) > parseInt(b_components[i])) {
			return 1;
		}

		// B bigger than A
		if (parseInt(a_components[i]) < parseInt(b_components[i])) {
			return -1;
		}
	}

	// If one's a prefix of the other, the longer one is greater.
	if (a_components.length > b_components.length) {
		return 1;
	}

	if (a_components.length < b_components.length) {
		return -1;
	}

	// Otherwise they are the same.
	return 0;
};


/**
 * 延时执行
 *
 * @param fn 要执行的函数
 * @param ms 延时长度
 */
window.Tea.delay = function (fn, ms) {
	if (typeof(ms) == "undefined") {
		ms = 10;
	}
	setTimeout(function () {
		fn.call(Tea.View.$scope);
		Tea.View.update();
	}, ms);
};

window.Tea.Help = false;

/**
 * 在控制台显示帮助信息
 */
if (window.top == window.self) {
	window.onresize = function () {
		if (!window.Tea.Help) {
			window.Tea.Help = true;

			console.log("%c Meloy & TeaPHP Javascript API Helps: \n   Tea.View.$scope - get angular $scope variable\n   Tea.View.$scope.xxx - print variables or functions in angular $scope\n   TEA.ACTION.data - show all data from action", "color:blue");
		}
	};
}
