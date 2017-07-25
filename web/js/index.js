Tea.View.scope(function () {
    var allApis = [];

    this.load = function () {
        //加载当前API
        Tea.action("/@api/all")
            .post()
            .success(function (response) {
                this.apis = response.data;
                allApis = this.apis;

                var apiPath = this.param("api");
                if (apiPath != null && apiPath.length > 0) {
                    var api = allApis.$find(function (k, v) {
                        return v.path == apiPath;
                    });
                    if (api != null) {
                        this.api = api;
                        this.path = api.path;

                        this.loadStat(this.path);
                    }
                }

                //选中第一个API
                else if (allApis.length > 0) {
                    window.location = "?api=" + allApis[0].path;
                }
            });

        //加载当前版本号
        Tea.action("/@api")
            .post()
            .success(function (response) {
                this.version = response.data.version;
            });
    };

    Tea.delay(function () {
        this.load();
    }, 0);

    this.loadStat = function (path) {
        var now = new Date();
        var url = "/@api/[" + path + "]/year/" + now.getFullYear() + "/month/" + (now.getMonth() + 1) + "/day/" + now.getDate();
        Tea.action(url)
            .post()
            .success(function (response) {
                this.stat = response.data;

                this.loadChart();
            });
    };

    this.loadChart = function () {
        var scope = this;
        var chart = echarts.init(document.getElementById("stat-chart"));
        var avgRequests = [];
        var countMinutes = 0;
        var totalRequests = 0;
        var totalHits = 0;
        var totalErrors = 0;

        var avgMs = [];
        var totalMs = 0;
        var avgHits = [];
        var avgErrors = [];

        var hours = [];

        if (scope.stat.minutes) {
            scope.stat.minutes.$each(function (k, v) {
                countMinutes ++;
                totalRequests += v.requests;
                avgRequests.push(v.requests);

                totalHits += v.hits;
                if (v.hits > 0) {
                    avgHits.push(v.hits);
                }
                else {
                    avgHits.push(0)
                }

                if (v.errors > 0) {
                    avgErrors.push(v.errors);
                }
                else {
                    avgErrors.push(null);
                }

                totalMs += v.avgMs;
                avgMs.push(parseInt(totalMs / countMinutes));

                if (!hours.$contains(v.hour)) {
                    hours.push(v.hour);
                }
                else {
                    hours.push(null);
                }
            });
        }

        var option = {
            title: {
                text: "今日统计 (" + scope.stat.avgMs + " ms/req " + scope.stat.requests + " requests " +  scope.stat.hits + " hits " + scope.stat.errors + " errors)",
                textStyle: {
                    fontSize: 14,
                    fontWeight: "normal",
                    color: "#666"
                },
                top: 0,
                x: "center"
            },
            tooltip : {
                trigger: 'axis',
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#6a7985'
                    }
                }
            },
            legend: {
                data:[ "请求次数(reqs/min)", "缓存命中次数(hits/min)", "错误次数(errors/min)" ],
                x: "center",
                y: "bottom"
            },
            toolbox: {
                feature: {
                    saveAsImage: {}
                }
            },
            grid: {
                top: '20%',
                left: '0%',
                right: '2%',
                bottom: '10%',
                containLabel: true
            },
            xAxis : [
                {
                    type : 'category',
                    boundaryGap : false,
                    data : hours,
                    splitLine: {
                        show: false
                    }
                }
            ],
            yAxis : [
                {
                    name: "次数",
                    type: "value",
                    max: null,
                    splitLine: {
                        show: false
                    }
                }
            ],
            series : [
                {
                    name: "请求次数(reqs/min)",
                    type:'line',
                    smooth: true,
                    animation: false,
                    stack: '总量',
                    /**lineStyle: {
						normal: {
							color: "#dda490"
						}
					},**/
                    itemStyle: {
                        normal: {
                            color: "#dda490"
                        }
                    },
                    areaStyle: {
                        normal: {
                            "color": "#dda490"
                        }
                    },
                    /**areaStyle: {normal: {
						"color": "green"
					}},**/
                    data:avgRequests
                },
                {
                    name: "缓存命中次数(hits/min)",
                    type:'line',
                    smooth: true,
                    animation: false,
                    yAxisIndex:0,
                    stack: '总量2',
                    symbol: 'none',
                    /**lineStyle: {
						normal: {
							color: "rgb(255, 70, 131)"
						}
					},**/
                    itemStyle: {
                        normal: {
                            color: "#8db9be"
                        }
                    },
                    areaStyle: {
                        normal: {
                            "color": "#8db9be"
                        }
                    },
                    data: avgHits
                },
                {
                    name: "错误次数(errors/min)",
                    type:'line',
                    smooth: true,
                    animation: false,
                    yAxisIndex:0,
                    stack: '总量3',
                    symbol: 'none',
                    /**lineStyle: {
						normal: {
							color: "rgb(255, 70, 131)"
						}
					},**/
                    itemStyle: {
                        normal: {
                            color: "pink"
                        }
                    },
                    areaStyle: {
                        normal: {
                            "color": "pink"
                        }
                    },
                    data: avgErrors
                }
            ]
        };

        chart.setOption(option);
    };


    this.refreshDebugLogs = function (path) {
        this.debugLogs = [];

        Tea.action("/@api/[" + path + "]/debug/flush")
            .post()
            .success(function (response) {
                this.debugLogs = response.data.debugLogs;

                setTimeout(function () {
                    angular.element(document.body).prop("scrollTop", 100000);
                }, 100);
            });
    };

    this.refreshApi = function () {
        window.location.reload();
    };

    this.searchApi = function (keyword) {
        var regexps = [];
        for (var i  = 0; i < keyword.length; i ++) {
            var char = keyword.charAt(i);
            if (!char.match(/\s/)) {
                regexps.push(new RegExp(char, "i"));
            }
        }

        function matchAll(s) {
            return regexps.$all(function(_, v) {
                return v.test(s);
            });
        }

        this.apis = allApis.$filter(function (k, v) {
            return matchAll(v.path) || matchAll(v.name);
        });
    };

    this.clearSearchKeyword = function () {
        this.apiKeyword = "";
        this.apis = allApis;
    };

    this.param = function (name) {
        var query = window.location.search;
        if (query.charAt(0) != "?") {
            return "";
        }
        var value = "";
        query.substr(1).split("&").$each(function (k, v) {
            var pieces = v.split("=", 2);
            if (pieces.length != 2) {
                return;
            }
            if (pieces[0] == name) {
                value = decodeURIComponent(pieces[1]);
                return;
            }
        });
        return value;
    };
});