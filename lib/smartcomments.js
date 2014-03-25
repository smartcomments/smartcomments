
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
            instance.comments_list = _.each(instance.comments_list, function(generatedComment, i) {
                var srcComment = instance.findMatchingComment(generatedComment, ast, source);
                if (srcComment) {
                    generatedComment.srcComment = srcComment;
                    instance.mergeSrcAndGeneratedComment(instance, generatedComment);
                }
            });
        },


        /**
         * Find a comment in the source that is for the same function as the given generatedComment.
         * @param {object} generatedComment - the smartcomments comment to match in the source.
         * @param {object} ast - the esprima-generated AST
         * @param {string} source - the text from the source file
         */
        findMatchingComment: function(generatedComment, ast, source) {
            var found;
            ast.comments.forEach(function(comment) {
                if (comment.type === 'Block'
                    && comment.range[1] < generatedComment.pos
                    && source.slice(comment.range[1], generatedComment.pos).match(/^\s*$/)) {

                    found = comment;
                }
            });
            return found;
        },

        /**
         * Merge a YUIDoc comment in the source file with the smartcomments- generated one.  Favor
         * entries from the source.  Save the merged comment lines in generatedComment.tags.
         *
         * @param instance {object} the SmartComments instance
         * @param generatedComment {object} the smartcomments comment object, with the source comment
         *      added as an attribute named generatedComment.srcComment.
         */
        mergeSrcAndGeneratedComment: function(instance, generatedComment) {

            var srcComment = generatedComment.srcComment,
                mergedCommentLines = [ ];

            // process each src comment line, and remove matching comments from generatedComment
            var srcCommentTags = _.map(srcComment.value.split(/\r?\n/), function(commentLine) {
                return instance.parseTagNameValue(commentLine);
            });

            _.each(generatedComment.tags, function(tag) {
                if (tag.name === '@method') {
                    mergedCommentLines.push(tag);

                } else if (tag.name === '@param') {
                    var srcTagVal = null;
                    _.each(srcCommentTags, function(srcTag) {
                        if (srcTag.name === '@param' && instance.isSameParam(srcTag.value, tag.value)) {
                            tag.value = srcTag.value;
                        }
                    });
                    mergedCommentLines.push(tag);

                } else {
                    var matchingSrcTags = instance.findMatchingSrcTags(tag, srcCommentTags);
                    if (matchingSrcTags && matchingSrcTags.length > 0) {
                        mergedCommentLines = mergedCommentLines.concat(matchingSrcTags);
                    } else {
                        mergedCommentLines.push(tag);
                    }
                }
            });

            instance.mergeOtherSrcTags(srcCommentTags, mergedCommentLines);
            generatedComment.tags = mergedCommentLines;
        },


        parseTagNameValue: function(commentLine) {
            var clean = commentLine.replace(/^\s*\*?\s*/, ''),    // strip leading ' * '
                nameValueMatch = /^(?:(@\w+)\s+)?([^\r\n]*)/.exec(clean);

            return {
                name: nameValueMatch[1] || '',
                value: nameValueMatch[2] || '',
            };
        },


        /**
         * For a @param comment line, check if the given srcParamCommentLine is for the same
         * parameter as the passed-in tag from the smartcomments-generated comment.
         *
         * @param srcValue {string} a @param comment line from the source file.
         * @param genValue {string} a @param value from a smartcomments-generated comment.
         * @return {boolean} true if the two describe the same parameter.  otherwise, false.
         */
        isSameParam: function(srcValue, genValue) {
            var stripTypeRe = /\{\w*\}/,
                matchValRe = /^\s*(\w+)/;
            srcValue = srcValue.replace(stripTypeRe, '');
            genValue = genValue.replace(stripTypeRe, '');
            return (matchValRe.exec(srcValue)[1] === matchValRe.exec(genValue)[1]);
        },


        findMatchingSrcTags: function(genTag, srcCommentTags) {
            var matching = _.reduce(srcCommentTags, function(memo, srcTag) {
                if (srcTag.name === genTag.name && (srcTag.name || srcTag.value)) {
                    memo.push(srcTag);
                }
                return memo;
            }, [ ]);
            return matching;
        },

        mergeOtherSrcTags: function(srcCommentTags, mergedCommentLines) {
            var i;
            for (i = 0; i < mergedCommentLines.length && !mergedCommentLines[i].name == '@method'; i += 1) ;

            _.each(srcCommentTags, function(srcTag) {
                switch (srcTag.name) {
                case '':
                    break;
                case '@method':
                    break;
                case '@param':
                    break;
                case '@return':
                    break;
                case '@returns':
                    break;
                default:
                    mergedCommentLines.splice(i++, 0, srcTag);
                }
            });
        },

        applyComments: function(comments_list, source) {
            var instance = SmartComments,
                size = comments_list.length,
                i = size - 1,
                comment;

            for (i; i >= 0; i--) {
                comment_value = instance.createComment(comments_list[i], source);
                var startPos = comments_list[i].pos,
                    endPos = null;
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
            var prefix = source.slice(0, startPos),
                suffix = source.slice(endPos || startPos);

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
