'use strict';

(function()
{
    function Context(services)
    {
        function initialize()
        {
            return { 
                on: 
                {
                    listen: function(name, handler)
                    {
                        if (handler instanceof Function)
                        {
                            if (!(on[name] instanceof Object)) on[name] = {};

                            let key = parseInt(Math.random() * 1000000000);

                            on[name][key] = handler;

                            return function() { if (on[name]) delete on[name][key] };
                        }
                    },

                    trigger: function(name, action)
                    {
                        if (on[name] instanceof Object)
                        {
                            if (!(action instanceof Function)) action = function() { };

                            Object.keys(on[name]).forEach(function(key)
                            {
                                on[name][key].call(ctx, action);
                            });
                        }
                    }
                }
            };
        }

        function notify(action)
        {
            function trigger(handlers, target, property, value, old)
            {
                Object.keys(handlers).forEach(function(name)
                {
                    handlers[name].forEach(function(handler)
                    {
                        if (action instanceof Function) action(handler, target, property, value, old);

                        handler.update();
                    });
                });
            }

            return function(target, property, value, old) {
                
                //trigger(partials.widgets.handlers, target, property, value, old);
                //trigger(partials.components.handlers, target, property, value, old);

                return true;
            };
        }

        function ready(invoke)
        {
            if (!invoke instanceof Function) return;

            /*for (let name in partials.widgets.state)
            {
                if (!partials.widgets.state[name]) return;
            }

            for (let name in partials.components.state)
            {
                if (!partials.components.state[name]) return;
            }*/

            /*for (var name in components.handlers)
            {
                components.handlers[name].forEach(function(handler)
                {
                    handler.update();
                });
            }*/

            invoke(ctx);
        }

        function register(type, config, model)
        {
            return new Promise(function(resolve, reject)
            {
                partials[type].partialify(config, model).then(function()
                {
                    ready(resolve);

                }, reject); 
            });
        }

        var ctx = this, handler = initialize(), language, on = {}, partials =
        {
            //components: new PartialsHandler(this, handler, notify, true),
            pages: new PartialsHandler(this, handler, notify, true),
            //widgets: new PartialsHandler(this, handler, notify)
        };

        this.use = {};
        this.events = new ObserveableObject(handler.on).use;
        this.services = new ObserveableObject(handler.services, undefined, undefined, notify()).use;

        this.language = function(value)
        {
            if (arguments.length == 0) return language;

            language = value;
        };

        this.pagination = function(config, model)
        {
            return register('pages', config, model);
        };

        this.reload = function(model)
        {
            this.model = new ObserveableObject(handler.model = model, undefined, undefined, notify()).use;

            this.use.shared =
            {
                context:
                {
                    events: this.events,
                    model: this.model,
                    services: this.services,
                    language: this.language
                }
            };
        };
    }

    function Loader(context, services)
    {
        function appelement()
        {
            return document.querySelector('app');
        }

        function pagination(config)
        {
            function register(name, parent)
            {
                pages[name] = Object.assign(config.pages[name], 
                { 
                    name: name,
                    tag: name + '-page',
                    url: 'pages/' + config.pages[name].view,
                    render: function()
                    {
                        var element = document.createElement('div'); parent.appendChild(element);

                        this.element = element;
                    }
                });

                pages[name].render();
            }

            var app = appelement(), pages = {}; if (!app) return pages;

            var router = app.querySelector('router'); if (!router) return pages;

            var route, routes = app.querySelectorAll('route');

            for (let i = 0; i < routes.length; i++)
            {
                let path = routes[i].getAttribute('path').split('/')[0];

                if (config.pages[path])
                {
                    register(path, routes[i]);
                }

                if (!path || (path.length && path.length == 0)) route = routes[i];
            }

            if (!route) return pages;

            for (let name in ctx.config.pages)
            {
                if (config.pages[name] instanceof Object && config.pages[name]['default'])
                {
                    register(name, route);

                    pages[''] = pages[name];

                    return pages;
                }
            }

            return pages;
        }

        var ctx = this, page, pages;

        this.boot = function()
        {
            function componentify()
            {
                return services.core.dynamix(ctx.config.boot.components, 'components', context.model);
            }

            function modelize()
            {
                return new Promise(function (resolve, reject)
                {
                    context.reload({}); riot.mixin('global-context', context.use.shared);
                    
                    if (!ctx.config.boot.model) return resolve();

                    var requests = Array.isArray(ctx.config.boot.model) ? ctx.config.boot.model : [ ctx.config.boot.model ];

                    if (requests.length == 0) return resolve();

                    Promise.all(requests.map(function(url)
                    {
                        return services.async.json(url, { cache: true });

                    })).then(function(results)
                    {
                        results.forEach(function(model)
                        {
                            if (model instanceof Object) Object.assign(context.model, model);

                            var language = context.language();
                            
                            if (language && context.model[language] instanceof Object)
                            {
                                Object.assign(context.model.lang = {}, context.model[language]);
                            }
                        });

                        resolve();
                        
                    }, reject);
                });
            }

            function serviceness()
            {
                return services.core.statix(ctx.config.boot.services, 'services');
            }

            function stylish()
            {
                return services.core.statix(ctx.config.boot.styles, 'styles');
            }

            function widgetize()
            {
                return services.core.dynamix(ctx.config.boot.widgets, 'widgets');
            }

            function mount()
            {
                return new Promise(function (resolve, reject)
                {
                    riot.compile(function()
                    {
                        riot.mount('router');

                        pages = pagination(ctx.config);

                    }); resolve(context);
                });
            }

            var app = appelement();

            return new Promise(function (resolve, reject)
            {
                if (!app) return reject('app element is required');

                services.async.json('config.json').then(function(config)
                {
                    if (!(config instanceof Object)) return reject('configuration object is missing');

                    if (!(config.pages instanceof Object)) return reject('`pages` section is missing in configuration object');

                    if (!(config.boot instanceof Object)) config.boot = {};
                    if (!(config.boot.components instanceof Object)) config.boot.components = {};
                    if (!(config.boot.services instanceof Object)) config.boot.services = {};
                    if (!(config.boot.widgets instanceof Object)) config.boot.widgets = {};

                    services.core = new CoreService(context, ctx.config = config, services);

                    if (context.initialize instanceof Function) context.initialize(context);
                    
                    modelize().then(stylish).then(serviceness).then(componentify).then(widgetize).then(mount).then(resolve, reject);

                }, console.error);
            });
        };

        this.page = function(name)
        {
            return new Promise(function (resolve, reject)
            {
                function parse()
                {
                    if (typeof(config.model) == 'string') return services.async.json(config.model).then(render)

                    if (Array.isArray(config.model))
                    {
                        return new Promise(function(resolve, reject)
                        {
                            Promise.all(config.model.map(function(model)
                            {
                                return services.async.json(model);

                            })).then(function(models)
                            {
                                config.model = {};

                                models.forEach(function(model)
                                {
                                    config.model = Object.assign(config.model, model);
                                });

                                render(config.model).then(resolve, reject);

                            }, reject);
                        });
                    }
                     
                    if (config.model instanceof Object) return render(config.model, true);
                }

                function render(model, render)
                {
                    function pagination()
                    {
                        return new Promise(function(resolve, reject)
                        {
                            if (render) config.render();

                            services.core.dynamix([ config ], 'pages', model).then(function(pages)
                            {
                                page = pages[0]; resolve();

                            }, reject);
                        });
                    }

                    function componentify()
                    {
                        return services.core.dynamix(config.components || [], 'components');
                    }

                    function widgetize()
                    {
                        return services.core.dynamix(config.widgets || [], 'widgets');
                    }

                    return pagination().then(widgetize).then(componentify);
                }

                if (page) page.unmount();

                var config = pages[name]; if (!config) return reject(services.text.format('`*` page is not registered', config.name));

                if (!config.hasOwnProperty('model')) return reject('every page must include a model property with a valid url as value');
                
                parse().then(resolve, reject);
            });
        };
    }

    function ObserveableObject(source, get, set, ready)
    {
        if (!(get instanceof Function)) get = function() {};
        if (!(set instanceof Function)) set = function() { return true };
        if (!(ready instanceof Function)) ready = function() { return true };

        var object = source || {}, proxy = new Proxy(object,
        {
            get: function(target, property) 
            {
                var value = get(target, property);

                return value === undefined ? target[property] : value;
            },

            set: function(target, property, value) 
            {
                if (value == target[property]) return true;

                if (set(target, property, value, target[property]))
                {
                    return ready(target, property, target[property] = value);
                }
                
                return false;
            }
        });

        this.use = proxy;
    }

    function PartialsHandler(context, handler, notify, shared)
    {
        var partials = 
        {
            ready: {},
            handlers: {}
        };

        Object.defineProperty(this, 'handlers', { get: function() { return partials.handlers } });
        Object.defineProperty(this, 'state', { get: function() { return partials.ready } });


        this.partialify = function(partial, model)
        {
            return new Promise(function(resolve, reject)
            {
                var key = partial.tag || partial.name;

                partials.ready[key] = false;

                if (!Array.isArray(partials.handlers[key])) 
                {
                    partials.handlers[key] = [];
                }

                handler[key] = 
                { 
                    /*context: shared ?
                    {
                        events: handler.on,
                        model: handler.model

                    } : undefined,*/

                    model: model === true ? {} : model,
                
                    on: 
                    {
                        ready: function(handler)
                        {
                            partials.ready[key] = new Date().getTime();
                            partials.handlers[key].push(handler);

                            handler.update(); resolve();
                        }
                    }
                };

                context.use[key] =
                {
                    /*context: 
                    {
                        events: shared ? context.events : undefined,
                        model: shared ? context.model : undefined,
                        services: context.services
                    },*/

                    events: new ObserveableObject(handler[key].on).use,
                    model: model ? new ObserveableObject(handler[key].model).use : undefined
                };
            });
        }
    }

    function AsyncService()
    {
        var ctx = this, cache = {};

        var Request = this.Request = function(config)
        {
            if (!(config instanceof Object)) return;

            var request = new XMLHttpRequest(); if (!request) return;

            return new Promise(function (resolve, reject)
            {
                if (config.cache && cache[config.url]) return resolve(cache[config.url]);

                request.onreadystatechange = function()
                {
                    if (request.readyState !== XMLHttpRequest.DONE) return;

                    if (request.status == 200)
                    {
                        if (config.cache) cache[config.url] = request;

                        resolve(request);
                    }
                    else reject(request);
                };

                request.open(config.method, config.url);
                request.send.apply(request, config.data ? [ config.data ] : undefined);
            });
        };

        this.content = function(url, config)
        {
            return new Promise(function (resolve, reject)
            {
                new Request(Object.assign({ method: 'GET', url: url }, config)).then(function(handler)
                {
                    resolve(config && config.format instanceof Function ? config.format(handler.responseText) : handler.responseText);

                }, reject);
            });
        };

        this.json = function(url, config)
        {
            return new Promise(function (resolve, reject)
            {
                ctx.content(url, config).then(function(content)
                {
                    resolve(JSON.parse(content));

                }, reject);
            });
        };

        this.script = function(url, config)
        {
            return new Promise(function (resolve, reject)
            {
                ctx.content(url, config).then(function(content)
                {
                    var type = 'script', 
                        scripteElement = document.createElement(type);

                    scripteElement.type = config.type || 'text/javascript';
                    scripteElement.innerHTML = '\n' + content + '\n';

                    var firstScriptElement = document.getElementsByTagName(type)[0];

                    if (!firstScriptElement) reject();
                
                    firstScriptElement.parentNode.appendChild(scripteElement);

                    resolve(scripteElement);

                }, reject);
            });
        };

        this.style = function(url, config)
        {
            return new Promise(function (resolve, reject)
            {
                ctx.content(url, config).then(function(content)
                {
                    var styleElement = document.createElement('style');
                    
                    styleElement.setAttribute('type', 'text/css');
                    
                    styleElement.innerHTML = content;
    
                    var head = document.getElementsByTagName('head')[0]; if (!head) return reject();
                    
                    head.appendChild(styleElement); resolve(styleElement);

                }, reject);
            });
        };
    }

    function CoreService(context, config, services)
    {
        function dependencies(configs)
        {
            var completed = {}, ordered = [].concat(configs.filter(function(config)
            {
                if (config.dependencies.length == 0) return completed[config.name] = true;

            })), dependents = configs.filter(function(config)
            {
                return config.dependencies.length > 0;

            }), done;

            do
            {
                done = true;

                dependents.forEach(function(config)
                {
                    if (ordered.indexOf(config) > - 1) return;

                    var ready = config.dependencies.filter(function(dependency)
                    {
                        return completed[dependency];

                    }).length == config.dependencies.length;

                    if (ready) 
                    {
                        ordered.push(config);

                        completed[config.name] = true;
                    }
                    else done = false;
                });

            } while (!done);

            return ordered;
        }

        function inject(config, type)
        {
            var injection = Object.assign({}, injections);

            injection.start = Object.assign({}, injections.start);

            var inject = type == 'widgets' || !page ? '' : services.text.format('this.mixin("*");this.events.ready(this);', page.tag);

            injection.start.value = services.text.format(injection.start.value, inject, config.name);

            return injection;
        }

        function multiple(keys, type, invoke)
        {
            return new Promise(function(resolve, reject)
            {
                if (!(config instanceof Object)) return reject('configuration object is missing');
                if (!Array.isArray(keys)) return reject('array of names is required');
                
                var configs = [];

                keys.forEach(function(key)
                {
                    if (typeof(config[type][key]) == 'string') return configs.push(config[type][key]);

                    if (!(config[type][key] instanceof Object)) return reject(services.text.format('configuartion for `*` in `*` section is missing', key, type));

                    Object.assign(config[type][key], 
                    { 
                        url: type + '/' + config[type][key].path,
                        dependencies: config[type][key].dependencies || [] 
                    });

                    config[type][key][key.indexOf('-') ? 'tag': 'name'] = key;

                    configs.push(config[type][key]);
                });

                invoke(configs, resolve, reject);
            });
        }

        var injections =
        {
            start: 
            {
                expression: '<script>',
                value: 'this.mixin("global-context");*;function initialize(context,*,remote,attr){var language=context.language();if(language&&ctx.model instanceof Object&&ctx.model[language] instanceof Object)Object.assign(ctx.model.lang={},ctx.model[language]);'
            }, 
            
            end:
            {
                value: '};var ctx=this,attr=function(name, value){if(arguments.length==1)return opts.hasOwnProperty(name)?opts[name]:undefined;opts[name]=value},bind=this.bind=function(name,value){var key=attr(name);if(key===undefined)return;var contextify=attr("contextify");var model=contextify!==undefined&&contextify!==false?ctx.context.model:ctx.model;if(!model)return;if(arguments.length==1)return ctx.context.services.core.bind(model,key);ctx.context.services.core.bind(model,key,value)};initialize(this.context,this,function(){return ctx.context.services.remote.attach(ctx)});'
            }
        }, verbs = 
        {
            components: 'componentify',
            widgets: 'widgetize'

        }, page;

        injections.end.expression = injections.start.expression[0] + '/' + injections.start.expression.substr(1);

        this.bind = function(data, field, value)
        {
            var current = data,
                sections = field.split('.'),
                last = sections.length - 1;

            for (let i = 0; i < last; i++)
            {
                if (!current[sections[i]]) break;
                
                current = current[sections[i]];
            }

            field = sections[last];

            if (arguments.length == 2) return current[field];
            
            current[field] = value; return true;
        };

        this.dynamix = function(keys, type, model)
        {
            function partialify(config, handler)
            {
                function mount(view)
                {
                    var tag;

                    return new Promise(function (resolve, reject)
                    {
                        riot.compile(view, function()
                        {
                            if (handler === true)
                            {
                                context.pagination.call(context, config, model).then(function(){});

                                //console.log(context.use)
                                riot.mixin(config.tag, context.use[config.tag]);
                                //riot.mixin(context.use[config.tag]);

                                tag = riot.mount(config.element, config.tag);
                            }
                            else if (handler)
                            {
                                if (page)
                                {
                                    //context[handler].call(context, config, page ? page.model : model).then(function(){});

                                    riot.mixin(page.tag, context.use[page.tag]);

                                    let elements = page.element.querySelectorAll(config.tag);

                                    for (let i = 0; i < elements.length; i++)
                                    {
                                        riot.mount(elements[i], config.tag);
                                    }
                                }
                            }

                            resolve(tag);
                        });
                    });
                }

                function view()
                {
                    return services.async.content(config.url,
                    {
                        cache: true,
                        format: function(content)
                        {
                            if (handler === true) page = config;

                            var injection = inject(config, type);

                            return injection ? services.text.inject(content, injection.start, injection.end) : content;
                        }
                    });
                }

                return new Promise(function (resolve, reject)
                {
                    if (!(config instanceof Object)) return reject(services.text.format('missing configuration for `*`!', name));
                
                    view().then(mount).then(resolve, reject);
                });
            };

            if (type == 'pages') 
            {
                return partialify(Object.assign(keys[0], { model: model }), true);
            }

            return multiple(keys, type, function(configs, resolve, reject)
            {
                var handlers = [];

                configs.forEach(function(config)
                {
                    config.page = page;

                    handlers.push(partialify(config, verbs[type]));
                });

                Promise.all(handlers).then(resolve, reject);
            });
        };

        this.statix = function(keys, type)
        {
            function serviceness(configs)
            {
                function serve(config)
                {
                    return services.async.script(config.url, 
                    {
                        cache: true,
                        format: function(content)
                        {
                            return services.text.format('woosh.service("*",*);', config.tag, content);
                        }
                    });
                }

                return new Promise(function (resolve, reject)
                {
                    if (!Array.isArray(configs)) reject();

                    var requests = configs.map(serve);

                    if (requests.length == 0) return resolve();

                    Promise.all(requests).then(function()
                    {
                        Object.keys(services).forEach(function(name)
                        {
                            context.services[name] = services[name];
                        });

                        Object.keys(config.services).forEach(function(name)
                        {
                            var Service = woosh.service(name);

                            if (Service)
                            {
                                context.services[name] = new Service(context);
                            }
                            else
                            {
                                console.warn(services.text.format('`*` service fail to load. please check your `boot` configuration', name));
                            }
                            
                        });

                        resolve();

                    }, reject);
                });
            }

            function stylish(configs)
            {
                function serve(config)
                {
                    return services.async.style(config, { cache: true });
                }

                return new Promise(function (resolve, reject)
                {
                    if (!Array.isArray(configs)) reject();

                    var requests = configs.map(serve);

                    if (requests.length == 0) return resolve();

                    Promise.all(requests).then(resolve, reject);
                });
            }

            return multiple(keys, type, function(configs, resolve, reject)
            {
                var loader;

                switch (type)
                {
                    case 'services': loader = serviceness; break;
                    case 'styles': loader = stylish; break;
                }

                if (loader) return loader(configs).then(resolve, reject);

                reject(services.text.format('type `*` is not defined', type));
            });
        };
    }

    function RemoteService()
    {
        var handlers = {};

        this.attach = function(context)
        {
            var key = parseInt(Math.random() * 1000000000);

            return {
                
                activate: function()
                {
                    if (handlers[key]) return handlers[key].apply(context, arguments);
                },

                remote: function(handler)
                {
                    handlers[key] = handler;
                }
            };
        };

        this.register = function(context, name, handler)
        {
            if (context.opts[name] instanceof Function)
            {
                context.opts[name](handler);
            }
        };
    }

    function TextService()
    {
        var placeholder = '*', newline = '\n', space = ' ';
        
        Object.defineProperty(this, 'newline', { get: function() { return newline } });

        this.between = function(value, start, end, index)
        {
            var from = value.indexOf(start, index),
                to = value.indexOf(end, index);

            if (from > -1 && to > -1) 
            {
                from++; return value.substr(from, to - from);
            }
        },

        this.format = function(template)
        {
            var value = template;

            for (let i = 1; i < arguments.length; i++)
            {
                value = value.replace(placeholder, arguments[i]);
            }

            return value;
        };

        this.inject = function(content, start, end)
        {
            if (!(start instanceof Object) || !(end instanceof Object)) return content;

            end.index = content.indexOf(end.expression);
            start.index = content.indexOf(start.expression);

            if (end.index < 0 || start.index < 0) return content;

            start.index += start.expression.length;

            return this.line(content.substr(0, start.index), start.value, content.substring(start.index, end.index), end.value, content.substr(end.index));
        };

        this.join = function(separator)
        {
            return Array.prototype.join.call(arguments, separator);
        };

        this.line = function()
        {
            return Array.prototype.join.call(arguments, newline);
        };

        this.space = function()
        {
            return Array.prototype.join.call(arguments, space);
        };
    }

    function WaitService()
    {
        var wait = {};

        this.empty = function(name)
        {
            return !Array.isArray(wait[name]) || wait[name].length == 0;
        };

        this.trigger = function(name, context)
        {
            if (this.empty(name)) return false;

            var ctx = this;

            wait[name].forEach(function(handler)
            {
                handler.call(context || ctx);
            });

            delete wait[name];

            return true;
        };

        this.when = function(name, handler)
        {
            if (!Array.isArray(wait[name])) wait[name] = [];

            if ((handler instanceof Function)) wait[name].push(handler);
        };
    }

    function Woosh()
    {
        function Route(page, action)
        {
            Object.defineProperty(this, 'action', { get: function() { return action } });
            Object.defineProperty(this, 'page', { get: function() { return page } });
            Object.defineProperty(this, 'query', 
            { 
                get: function() 
                { 
                    var query = route.query();
                    
                    return Object.keys(query).length > 0 ? query : undefined;
                } 
            });

            this.load = function()
            {
                return loader.page(this.page);
            };
        }

        var services = 
            {
                async: new AsyncService(),
                remote: new RemoteService(),
                text: new TextService(),
                wait: new WaitService()
            },
            context = new Context(services),
            loader = new Loader(context, services),
            register = 
            {
                services: {}
            };
        
        this.start = function(init)
        {
            context.initialize = init;

            if (document.readyState == 'complete') return loader.boot();

            return new Promise(function(resolve, reject)
            {
                window.addEventListener('load', function()
                {
                    loader.boot().then(resolve, reject);
                });
            });
        };

        this.service = function(name, handler)
        {
            if (arguments.length == 1) return register.services[name];

            if (handler instanceof Function) register.services[name] = handler;
        };

        route(function(page, action, query) 
        {
            var route = new Route(page, action);

            route.load().then(function()
            {
                context.use.shared.context.route = route;
                
                context.use.shared.context.events.trigger('app_route'); 

            }, console.error);
        });
    }

    window.woosh = new Woosh();
})();