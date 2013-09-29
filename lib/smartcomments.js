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

            //atach defined functions to walker
            instance.attachWalkFunctions();

            instance.config = config;

            template_path = config.template || '../templates/default.js';

            template_path = path.join(template_path);

            try {
                instance.template = require(template_path);
            } catch (e) {
                console.log('Cannot find template:');
                console.log(template_path);
            }

            if (instance.template) {
                instance.template.initialize(config);
                return true;
            }

            return false;
        },

        //attach defined functions to walker
        attachWalkFunctions: function() {
            var instance = this,
                SmartCommentsWalker = instance.SmartCommentsWalker,
                walkFunctions = instance.walkFunctions;

            //TODO: this might be dinamic
            SmartCommentsWalker.enterFunctionExpression = walkFunctions.enterFunctionExpression;
            SmartCommentsWalker.enterFunctionDeclaration = walkFunctions.enterFunctionDeclaration;
            SmartCommentsWalker.enterVariableDeclaration = walkFunctions.enterVariableDeclaration;
        },

        generate: function(source) {
            var instance = SmartComments,
                ast;

            try {
                ast = instance.esprima.parse(source, {
                    tokens: true,
                    range: true,
                    tolerant: true
                });
            } catch (e) {
                console.log('Sorry, we have been some problems to parse your code');
                console.log(e);
            }
            if (ast) {
                instance.comments_list = [];

                instance.template.setCommentsList(instance.comments_list);

                instance.SmartCommentsWalker.walk(ast);

                instance.comments_list = instance.template.getCommentsList();

                return SmartComments.applyComments(instance.comments_list, source);
            } else {
                return false;
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
        walkFunctions: {
            enterFunctionExpression: function(node, parent, fieldName, siblings, index) {
                var instance = SmartComments,
                    params = {
                        node: node,
                        parent: parent,
                        fieldName: fieldName,
                        siblings: siblings,
                        index: index
                    };

                instance.template.executeWalk('enterFunctionExpression', params);
            },

            enterFunctionDeclaration: function(node, parent, fieldName, siblings, index) {
                var instance = SmartComments,
                    params = {
                        node: node,
                        parent: parent,
                        fieldName: fieldName,
                        siblings: siblings,
                        index: index
                    };

                instance.template.executeWalk('enterFunctionDeclaration', params);
            },

            enterVariableDeclaration: function(node, parent, fieldName, siblings, index) {
                var instance = SmartComments,
                    params = {
                        node: node,
                        parent: parent,
                        fieldName: fieldName,
                        siblings: siblings,
                        index: index
                    };

                instance.template.executeWalk('enterVariableDeclaration', params);
            }
        },

        comments_list: [],
        //esprima object
        esprima: {},

        //WalkerInterface
        SmartCommentsWalker: {},

        config: {},

    }

module.exports = {
    initialize: SmartComments.initialize,
    generate: SmartComments.generate
};
