var path = require('path'),
    fs = require('fs'),
    fs_extra = require('fs-extra'),
    mods = {

        readConfig: function(current_dir, callback) {
            var result_list = [],
                config_file,
                config;

            //comprobar que current_dir existe
            if(fs.existsSync(current_dir)){
                mods.searchByFilter(current_dir, {
                    count: 1,
                    filter: {
                        func: mods.isMatching,
                        params: ['smartcomments.json']
                    }
                }, result_list);                
            } else {
                console.log('!!!Ups, Cannot find your supply config file');
            }

            //default config
            config_file = path.join(__dirname, '..', 'config', 'smartcomments.json');

            //he encontrado uno
            if (result_list.length > 0) {
                config_file = result_list[0];
                console.log('-Loading configuration from:');
                console.log(config_file);
            } else {
               console.log('-Using default config...'); 
            }

            config = fs.readFileSync(config_file, 'utf8');

            try {

                config = JSON.parse(config);
            } catch (e) {
                console.log('Failed to parse smartcomments.json file: ');
                console.log(e);
                process.exit(1);
                return;
            }

            if (callback) {
                callback(config);
            }
        },

        isMatching: function(filename, params) {
            var temp = false,
                re;

            params.forEach(function(item) {
                //console.log(item);
                re = new RegExp(item);

                if (re.test(filename)) {
                    temp = true;
                    return;
                }

            });
            return temp;
        },

        searchByFilter: function(source, options, result) {

            if (result.length < options.count || options.count == -1) {
                if (!fs.existsSync(source)) {
                    return;
                }

                var stat = fs.statSync(source);

                //si pasa el filtro
                if (options.filter.func(source, options.filter.params)) {

                    stat = fs.statSync(source);

                    if (!stat.isDirectory()) {
                        result.push(source);
                    }
                }

                if (stat.isDirectory()) {
                    var dirs = fs.readdirSync(source),
                        p;

                    dirs.forEach(function(d) {
                        p = path.join(source, d),
                        mods.searchByFilter(p, options, result);
                    });
                }
            }
        },

        argvParse: function(argv){
            var parsed = {},
                item,
                size = argv.length,
                i = 0;
            if(size < 1)
                return false;
            for ( i; i < size; i++ ) {
                item = argv[i];
                    if(item.indexOf("-") === 0){
                       parsed[item] = '';
                        if((i+1) < size && argv[i+1].indexOf("-") !== 0){
                            parsed[item] = argv[++i];
                        }                        
                    }
            };
            return parsed;
        },

        getCommand: function(parsedArgv, commands){
            var key = Object.keys(parsedArgv),
                size = commands.length,
                i = 0;
            for (i; i < size; i++) {
                if(commands[i].alias[key[0]])
                    return commands[i];
            };
            return false;
        },

        getCommandOptions: function(argv, command){
            var keys = Object.keys(argv),
                optionsKeys = Object.keys(command.options),
                options = command.options,
                optionsKeysSize = optionsKeys.length,
                optionsKeysItem,
                i = 0,
                keysSize = keys.length,
                keysItem,
                j;

            for (i; i < optionsKeysSize; i++) {
                optionsKeysItem = optionsKeys[i];
                if(options[optionsKeysItem].alias){
                    for (j = 1; j < keysSize; j++) {
                        keysItem = keys[j];
                        if(options[optionsKeysItem].alias[keysItem]){
                            command.options[optionsKeysItem].value = argv[keysItem];
                        }
                    };
                }
            };
            return command;
        }
    }

module.exports = {
    readConfig: mods.readConfig,
    isMatching: mods.isMatching,
    searchByFilter: mods.searchByFilter,
    argvParse: mods.argvParse,
    getCommand: mods.getCommand,
    getCommandOptions: mods.getCommandOptions
};
