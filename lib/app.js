var smartcomments = require('./smartcomments'),
    util = require('./util'),
    fs = require('fs'),
    path = require('path'),
    App = {
        init: function() {
            console.log('Hello!!!');
            var instance = App,
                command = process.argv[2],
                pack = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')),
                version = pack.version,
                options = {};

            console.log('using smartcomments@' + version + ' on node@' + process.versions.node);

            if (command === '--generate' || command === '-g') {
                if(process.argv[3] === '--target' || process.argv[3] === '-t'){
                    if(process.argv[4] !== '') {
                        options.target = process.argv[4]; 
                    }
                }
                instance.generate(options);
            }else {
                instance.help();
            }
        },

        generate: function(options) {
            console.log('-Reading Config ... ');
            App.config = util.readConfig(function(config) {
                if (config) {
                    console.log('-Looking Files ...');

                    var files_list = [],
                        sc_options = {
                            count: -1,
                            filter: {
                                func: util.isMatching,
                                params: config.match_files
                            }
                        },
                        current_dir = process.cwd();

                    if(options.target){
                        current_dir = options.target; 
                    } else if (config.target_dir[0] !== '') {
                        current_dir = config.target_dir[0];
                    }

                    util.searchByFilter(current_dir, sc_options, files_list);

                    console.log('..We found ' + files_list.length + ' files...');
                    console.log('-Generating comments... ');

                    if (smartcomments.initialize(config)) {
                        var code = '',
                            result = '';

                        files_list.forEach(function(d) {

                            code = fs.readFileSync(d, 'utf8');
                            if (code.length > 0) {
                                result = smartcomments.generate(code);

                                if (result) {
                                    if (config.backup) {
                                        var folder = path.dirname(d),
                                            file_name = '~' + path.basename(d),
                                            temp = path.join(folder, file_name);

                                        if (fs.existsSync(temp)) {
                                            //borrar
                                            fs.unlinkSync(temp);
                                        }

                                        fs.writeFile(temp, code, function(err) {
                                            if (err) throw err;
                                        });

                                    }

                                    fs.writeFile(d, result, function(err) {
                                        if (err) throw err;
                                    });
                                } else {
                                    console.log(d);
                                }


                            }

                        });

                        console.log('...Done...');
                    } else {
                        console.log('Failed: Something wrong');
                    }


                }

            });
        },

        help: function() {
            var message = 'command line options:\n\n' +
                '    -h, --help  Show this sttuf\n' +
                '-g, --generate  Generate comments from your source\n'+
                '  -t, --target  Specifies the target from which to generate \n\n';

            console.log(message);
        }


    } //end app

module.exports = {
    init: App.init
};
