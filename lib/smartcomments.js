var esprima = require('esprima'),
    eswalker = require('eswalker'),
    fs = require('fs'),
    path = require('path'),
    SmartComments = {

        initialize: function(config) {
            var instance = SmartComments,
                template_path;

            //initializing our own walker 
            instance.SmartCommentsWalker = eswalker.createWalker();

            //esprima obj
            instance.esprima = esprima;

            instance.config = config;

            template_path = config.template || '../templates/default.js';

            template_path = path.join(template_path);

            try {
                var custom_template = require(template_path);
                instance.template = BaseTemplate;
                //TODO: Esto deberia ser dinamico pero quedaria el problema de los parametros
                instance.template.walkFunctions = custom_template.walkFunctions;
                instance.template.tags = custom_template.tags(instance.template);
            } catch (e) {
                console.log('Cannot find template:');
                console.log(template_path);
            }

            if (instance.template) {
                instance.template.initialize(config);

                //build users defined functions to walker
                instance.buildWalkFunctions();
                return true;
            }

            return false;
        },

        //esto es para que walker sepa que funciones son las que tiene que ejecuctar
        buildWalkFunctions: function() {
            var instance = this,
                template = instance.template,
                SmartCommentsWalker = instance.SmartCommentsWalker,
                default_function,
                walkFunctions = template.walkFunctions();

            walkFunctions.forEach(function(item, index){
                default_function = function(node, parent, fieldName, siblings, index) {
                        var instance = template,
                            params = {
                                node: node,
                                parent: parent,
                                fieldName: fieldName,
                                siblings: siblings,
                                index: index
                            };
                        instance.executeWalk(item.name, params);
                };

                if(item.func){
                    //user custom function
                    default_function = func;
                }
                SmartCommentsWalker[item.name] = default_function;
            });
       
        },

        generate: function(source) {
            var instance = SmartComments,
                ast,
                result = {};

            try {
                ast = instance.esprima.parse(source, {
                    tokens: true,
                    range: true,
                    tolerant: true
                });
            } catch (e) {
                result.error = { 
                    message: 'Sorry, we have been some problems to parse your code',
                    details: e
                };
            }
            if (ast) {
                instance.comments_list = [];

                instance.template.setCommentsList(instance.comments_list);

                instance.SmartCommentsWalker.walk(ast);

                instance.comments_list = instance.template.getCommentsList();

                return SmartComments.applyComments(instance.comments_list, source);
            } else {
                return result;
            }
        },

        applyComments: function(comments_list, source) {
            var instance = SmartComments,
                size = comments_list.length,
                i = size - 1,
                comment;

            for (i; i >= 0; i--) {
                comment_value = instance.createComment(comments_list[i], source);
                source = instance.insertString(comment_value, comments_list[i].pos, source);
            };

            return source;
        },

        createComment: function(comment, source) {
            var value = '/**\n',
                tag_list = comment.tags,
                size = tag_list.length,
                i = 0,
                iterator = comment.pos - 1,
                buffer = '';

            while (iterator > 0 && source[iterator] !== '\n') {
                buffer += source[iterator];
                iterator--;
            }

            for (i; i < size; i++) {
                value += buffer + ' * ' + tag_list[i].name;
                if (tag_list[i].name !== '') {
                    value += ' ';
                }
                value += tag_list[i].value + '\n';

            };

            value += buffer + ' */\n' + buffer;
            return value;
        },

        insertString: function(value, pos, source) {
            var last = source.slice(0, pos) + value + source.slice(pos);
            return last;
        },

        //ATTRS
        comments_list: [],
        //esprima object
        esprima: {},

        //WalkerInterface
        SmartCommentsWalker: {},

        config: {},

    };

    BaseTemplate = {
        initialize: function(config) {
            var instance = BaseTemplate;
            instance.config = config;
        },

        executeWalk: function(walkname, params) {
            var instance = BaseTemplate,
                tags;

            //For every tag 
            Object.keys(instance.tags).forEach(function(item, index) {
                if (instance.tags[item][walkname] && instance.config.tags[item]) {
                    instance.tags[item][walkname](params);
                }
            });
        },

        getCommentsList: function() {
            var instance = BaseTemplate;
            return instance.comments_list;
        },

        setCommentsList: function(list) {
            var instance = BaseTemplate;
            instance.comments_list = list;
        },

        //ATTR
        comments_list: [],
        config: {}   
    };

module.exports = {
    initialize: SmartComments.initialize,
    generate: SmartComments.generate
};
