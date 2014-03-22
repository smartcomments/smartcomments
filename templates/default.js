var MyTemplate = {

    /**
     * Return a list with the name of node visitor functions that will be used in this template 
     * @method walkFunctions
     * @return [] walkFunctions
     */
    walkFunctions: function(){
        var walkFunctions = [
            {name: 'enterFunctionExpression'},
            {name: 'enterFunctionDeclaration'},
            {name: 'enterVariableDeclaration'}
        ];

        return walkFunctions;
    },

    /**
     * Allow to write custom tags
     * @method tags
     * @param {} template_instance object through which we can access the attributes like config, comment_list, etc
     * @return tags Object that contains the custom tags implementations
     */
    tags: function(template_instance){

        var tags = {
            //The function tag implementation
            function: {
                /**
                 * Define the way to build comments for functions tag
                 * @method buildComment
                 * @param {} data
                 * @return 
                 */
                buildComment: function(data) {
                    var instance = template_instance,                  //BaseTemplate instance
                        config = instance.config,                      //User current config               
                        available_options = config.tags.function,      //Custom functions tags options
                        pos,                                           // Empty comment obj
                        comment = {                                     
                            pos: data.pos,
                            tags: []
                        },
                        method_name = data.name,
                        node = data.node,
                        params = [],
                        default_value = 'My function Description';

                    if (typeof(config.private) === 'undefined'
                        || config.private
                        || !/^_/.test(method_name)) {

                        //Description statement
                        if (available_options.desc) {
                            if (available_options.desc.value) {
                                default_value = available_options.desc.value;
                            }

                            comment.tags.push({
                                name: '',
                                value: default_value
                            });
                        }

                        //@method statement
                        if (method_name && available_options.name) {
                            comment.tags.push({
                                name: '@method',
                                value: method_name
                            });
                        }

                        //@param statement
                        if (available_options.params) {
                            var array = node.params,
                                size = array.length,
                                i = 0,
                                value;
                            for (i; i < size; i++) {
                                params.push({
                                    name: array[i].name,
                                    type: array[i].type
                                });
                                value = '{} ' + array[i].name;
                                comment.tags.push({
                                    name: '@param',
                                    value: value
                                });
                            };
                        }

                        //@return statement
                        if (available_options.rtrn) {
                            var body_elements = node.body.body;

                            if (body_elements) {
                                var size = body_elements.length,
                                    value = '';
                                i = 0;
                                for (var i = 0; i < size; i++) {
                                    if (body_elements[i].type === 'ReturnStatement') {
                                        if (body_elements[i].argument) {
                                            if (body_elements[i].argument.name) {
                                                value = body_elements[i].argument.name;
                                            } else {
                                                value = body_elements[i].argument.type;
                                            }

                                        }
                                    }
                                };

                                comment.tags.push({
                                    name: '@return',
                                    value: value
                                });
                            }

                        }



                        if (comment.pos >= 0) {
                            //Add comment to comment_list
                            instance.comments_list.push(comment);
                        }
                    }
                },

                /**
                 * Concrete visitor function implementation for functions tags in default Template
                 * @method enterFunctionExpression
                 * @param {} params Object that contains properties like node, parent, fieldName, siblings, index
                 * @return 
                 */
                enterFunctionExpression: function(params) {
                    var instance = this,
                        comment_data = {},
                        parent = params.parent;

                    if (parent.type === 'Property') {

                        if (parent.key) {
                            comment_data.name = parent.key.name;
                        }

                        comment_data.pos = parent.range[0];
                        comment_data.node = params.node;
                        instance.buildComment(comment_data);
                    }
                    else if(parent.type === 'AssignmentExpression') {
                        
                        if(parent.right.type === 'FunctionExpression') {
                            
                            if (parent.left.property && parent.left.property.name) {
                                comment_data.name = parent.left.property.name;
                            }
                            
                            comment_data.pos  = parent.left.range[0];
                            comment_data.node = parent.right;
                            instance.buildComment(comment_data);
                        }
                    }
                },

                /**
                 * Concrete visitor function implementation for functions tags in default Template
                 * @method enterFunctionDeclaration
                 * @param {} params Object that contains properties like node, parent, fieldName, siblings, index
                 * @return 
                 */
                enterFunctionDeclaration: function(params) {
                    var instance = this,
                        node = params.node,
                        comment_data = {
                            pos: node.range[0],
                            name: node.id.name,
                            node: node
                        };
                    instance.buildComment(comment_data);
                },

                /**
                 * Concrete visitor function implementation for functions tags in default Template
                 * @method enterVariableDeclaration
                 * @param {} params Object that contains properties like node, parent, fieldName, siblings, index
                 * @return 
                 */
                enterVariableDeclaration: function(params) {
                    var instance = this,
                        node = params.node,
                        declarations = node.declarations,
                        size = declarations.length,
                        i = 0,
                        item,
                        comment_data = {};

                    for (i; i < size; i++) {
                        item = declarations[i];
                        if (item.init && item.init.type === 'FunctionExpression') {
                            comment_data.name = item.id.name;
                            comment_data.node = item.init;
                        }

                    };

                    if (comment_data.name) {
                        comment_data.pos = node.range[0];
                        instance.buildComment(comment_data);
                    }
                }


            }
        }
        return tags;
    }
}

module.exports = {
    walkFunctions: MyTemplate.walkFunctions,
    tags: MyTemplate.tags
};
