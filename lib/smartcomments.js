
var esprima = require('esprima'),
    eswalker = require('eswalker'),
    path = require('path'),
    _ = require('underscore'),
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
                //TODO: Might be dinamically
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
                    tolerant: true,
                    comment: true
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

                instance.mergeWithExistingComments(instance, ast, source);

                return instance.applyComments(instance.comments_list, source);

            } else {
                return result;
            }
        },


        /**
         * Find any comments for functions in the source and merge them with the smartcomments-
         * generated ones.
         * @param instance {object} the SmartComments instance
         * @param {object} ast - the esprima-generated AST
         * @param {string} source - the text from the source file
         */
        mergeWithExistingComments: function(instance, ast, source) {
            instance.comments_list = _.each(instance.comments_list, function(smartComment, i) {
                var srcComment = instance.findMatchingComment(smartComment, ast, source);
                if (srcComment) {
                    smartComment.srcComment = srcComment;
                    instance.mergeSrcAndSmartComment(instance, smartComment);
                } else {
                    // still remove 'Description' comment line
                    smartComment.tags = smartComment.tags.slice(1);
                }
            });
        },


        /**
         * Find a comment in the source that is for the same function as the given smartComment.
         * @param {object} smartComment - the smartcomments comment to match in the source.
         * @param {object} ast - the esprima-generated AST
         * @param {string} source - the text from the source file
         */
        findMatchingComment: function(smartComment, ast, source) {
            var found;
            ast.comments.forEach(function(comment) {
                if (comment.type === 'Block'
                    && comment.range[1] < smartComment.pos
                    && source.slice(comment.range[1], smartComment.pos).match(/^\s*$/)) {

                    found = comment;
                }
            });
            return found;
        },

        /**
         * Merge a YUIDoc comment in the source file with the smartcomments- generated one.  Favor
         * entries from the source.  Save the merged comment lines in smartComment.tags.
         *
         * @param instance {object} the SmartComments instance
         * @param smartComment {object} the smartcomments comment object, with the source comment
         *      added as an attribute named smartComment.srcComment.
         */
        mergeSrcAndSmartComment: function(instance, smartComment) {

            var srcComment = smartComment.srcComment;
            var mergedCommentLines = [ ];

            _.each(srcComment.value.split(/\r?\n/), function(commentLine) {

                instance.removeDuplicateTag(instance, commentLine, smartComment);

                commentLine = commentLine.replace(/^\s*\*?\s*/, '');    // strip leading ' * '
                if (commentLine) {
                    mergedCommentLines.push({
                        name: '',
                        value: commentLine,
                    });
                }
            });

            _.each(smartComment.tags, function(scTag) {
                if (scTag.name) {
                    mergedCommentLines.push(scTag);
                }
            });

            smartComment.tags = mergedCommentLines;
        },


        /**
         * For the given commentLine (from the source file), remove any duplicate tag found in the
         * smartComment.
         *
         * @param instance {object} the SmartComments instance
         * @param commentLine {string} source comment line
         * @param smartComment {object} the smartcomments comment to look through for a duplicate
         *      entry to delete.
         */
        removeDuplicateTag: function(instance, commentLine, smartComment) {
            var tagNameValue = /@\w+\s+[^\r\n]+/.exec(commentLine);
            if (tagNameValue) {
                var match = /^(@\w+)\s+([^\r\n]+)/.exec(tagNameValue);
                var tagname = match[1];
                var tagvalue = match[2];

                var iToRemove = -1;
                _.each(smartComment.tags, function(scTag, i) {
                    if (scTag.name && scTag.name === tagname) {
                        if (scTag.name !== '@param' || instance.isSameParam(tagvalue, scTag.value)) {
                            iToRemove = i;
                        }
                    }
                });

                if (iToRemove > -1) {
                    smartComment.tags.splice(iToRemove, 1);
                }
            }
        },

        /**
         * For a @param comment line, check if the given srcParamCommentLine is for the same
         * parameter as the passed-in tag from the smartcomments-generated comment.
         *
         * @param srcParamCommentLine {string} a @param comment line from the source file.
         * @param tag {object} a @param tag from a smartcomments-generated comment.
         * @return {boolean} true if the two describe the same parameter.  otherwise, false.
         */
        isSameParam: function(srcParamCommentLine, tag) {
            var stripTypeRe = /\{\w*\}/;
            srcParamCommentLine = srcParamCommentLine.replace(stripTypeRe, '');
            tag = tag.replace(stripTypeRe, '');
            var re = /\s*(\w+)/;
            var ans = (re.exec(srcParamCommentLine)[1] === re.exec(tag)[1]);
            return ans;
        },

        applyComments: function(comments_list, source) {
            var instance = SmartComments,
                size = comments_list.length,
                i = size - 1,
                comment;

            for (i; i >= 0; i--) {
                comment_value = instance.createComment(comments_list[i], source);
                var startPos = comments_list[i].pos;
                var endPos = null;
                if (comments_list[i].srcComment) {
                    startPos = comments_list[i].srcComment.range[0];
                    endPos = comments_list[i].pos;
                }
                source = instance.insertString(comment_value, startPos, endPos, source);
            };

            return source;
        },

        createComment: function(comment, source) {
            var value = '/**\n',
                tag_list = comment.tags,
                size = tag_list.length,
                i = 0,
                iterator = comment.pos - 1,
                buffer = '',
                currentChar,
                especialChars = "!@#$%^&*()+=-[]\\';,./{}|\":<>?\n";

            if(comment.pos === 0)
                iterator = 0;
            while (iterator > 0 ) {
                currentChar = source[iterator]
                if(especialChars.indexOf(currentChar) != -1 ){
                    if(currentChar !== '\n'){
                        value = '\n' + value;
                    }
                    break;
                }
                buffer += currentChar;
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

        insertString: function(stringToInsert, startPos, endPos, source) {
            var prefix = source.slice(0, startPos); 
            var suffix = source.slice(endPos || startPos);

            return prefix + stringToInsert + suffix;
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
