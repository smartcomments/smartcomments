var path = require('path'),
    fs = require('fs'),
    fs_extra = require('fs-extra'),
    mods = {

        readConfig: function(callback) {
            var current_dir = process.cwd(),
                result_list = [],
                config_file,
                config;

            mods.searchByFilter(current_dir, {
                count: 1,
                filter: {
                    func: mods.isMatching,
                    params: ['smartcomments.json']
                }
            }, result_list);

            //default config
            config_file = path.join(__dirname, '..', 'config', 'config.json');

            //he encontrado uno
            if (result_list.length > 0) {
                config_file = result_list[0];
            }

            config = fs.readFileSync(config_file, 'utf8');

            try {

                config = JSON.parse(config);
            } catch (e) {
                console.log('Failed to parse config.json file: ');
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
        }


    }

module.exports = {
    readConfig: mods.readConfig,
    isMatching: mods.isMatching,
    searchByFilter: mods.searchByFilter
};
