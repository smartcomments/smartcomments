
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

        generate: function(source, config) {
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

                instance.mergeWithExistingComments(instance, ast, source, config.favor_generated);

                return instance.applyComments(instance.comments_list, source);

            } else {
                return result;
            }
        },


        /**
         * Find any comments for functions in the source and merge them with the smartcomments-
         * generated ones.
         * @method mergeWithExistingComments
         * @param instance {object} the SmartComments instance
         * @param {object} ast - the esprima-generated AST
         * @param {string} source - the text from the source file
         * @param {boolean} favorGenerated - if true, favor generated comment tags over those from the source file wherever there is no clear choice (e.g., @return, @returns)
         */
        mergeWithExistingComments: function(instance, ast, source, favorGenerated) {
            instance.comments_list = _.each(instance.comments_list, function(generatedComment, i) {
                var srcComment = instance.findMatchingComment(generatedComment, ast, source);
                if (srcComment) {
                    generatedComment.srcComment = srcComment;
                    instance.mergeSrcAndGeneratedComment(instance, generatedComment, favorGenerated);
                }
            });
        },


        /**
         * Find a comment in the source that is for the same function as the given generatedComment.
         * @method findMatchingComment
         * @param {object} generatedComment - the smartcomments comment to match in the source.
         * @param {object} ast - the esprima-generated AST
         * @param {string} source - the text from the source file
         * @return found {boolean}
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
         * @method mergeSrcAndGeneratedComment
         * @param {object} instance - the SmartComments instance
         * @param {object} generatedComment - the smartcomments comment object, with the source comment added as an attribute named generatedComment.srcComment.
         * @param {boolean} favorGenerated - if true, favor generated comment tags over those from the source file wherever there is no clear choice (e.g., @return, @returns)
         */
        mergeSrcAndGeneratedComment: function(instance, generatedComment, favorGenerated) {

            var srcComment = generatedComment.srcComment,
                mergedCommentLines = [ ];

            // process each src comment line, and remove matching comments from generatedComment
            var srcCommentTags = _.map(srcComment.value.split(/\r?\n/), function(commentLine) {
                return instance.parseTagNameValue(commentLine);
            });

            _.each(generatedComment.tags, function(tag) {
                if (tag.name === '@method' || (favorGenerated && tag.name === '@return')) {
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


        /**
         * Parse a src comment line into a tagname and value.  tagname will be '' if there is no tag.
         * @method parseTagNameValue
         * @param {string} commentLine - the src comment line to parse into tagname and value
         * @return {object} e.g., { name: '@param', value: '{string} commentLine - the src ...'}
         */
        parseTagNameValue: function(commentLine) {
            var clean = commentLine.replace(/^\s*\*?\s?/, ''),    // strip leading ' * '
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
         * @method isSameParam
         * @param srcValue {string} a @param comment line from the source file.
         * @param genValue {string} a @param value from a smartcomments-generated comment.
         * @return {boolean} true if the two describe the same parameter.  otherwise, false.
         */
        isSameParam: function(srcValue, genValue) {
            var stripTypeRe = /\{[\w:-]*\}/,
                matchValRe = /^\s*([\w:-]+)/;
            srcValue = srcValue.replace(stripTypeRe, '');
            genValue = genValue.replace(stripTypeRe, '');
            srcValue = matchValRe.exec(srcValue);
            genValue = matchValRe.exec(genValue);

            if (srcValue) {
                return (genValue && srcValue[1] === genValue[1]);
            } else {
                return !genValue;
            }
        },


        /**
         * For a given genTag tagname, find all src comment tags with the same tag name.
         * E.g., if genTag.name === '@param', this method returns all src comment tags that are @param tags.
         *
         * @method findMatchingSrcTags
         * @param {object} genTag - the generated comment tag with the tagname to match
         * @param {array} srcCommentTags - the src comment tags from a src comment block.
         * @return {array} matching - list of matching src tags
         */
        findMatchingSrcTags: function(genTag, srcCommentTags) {
            var matching = _.reduce(srcCommentTags, function(memo, srcTag) {
                if (srcTag.name === genTag.name && (srcTag.name || srcTag.value)) {
                    memo.push(srcTag);
                } else if (genTag.name === '@return' && srcTag.name === '@returns') {
                    // if using JSDoc, the source might be using @returns
                    memo.push(srcTag);
                }
                return memo;
            }, [ ]);
            return matching;
        },

        /**
         * Merge in src comment tags that don't have counterparts in the SmartComments templates - e.g., @class,
         * @static, etc.
         *
         * @method mergeOtherSrcTags
         * @param {array} srcCommentTags - src comment tags from a comment block in the source file.
         * @param {array} mergedCommentLines - list of output comment lines to add to (tags)
         */
        mergeOtherSrcTags: function(srcCommentTags, mergedCommentLines) {
            var i;
            for (i = 0; i < mergedCommentLines.length && mergedCommentLines[i].name !== '@method'; i += 1) ;

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
