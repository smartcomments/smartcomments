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
                options = {},
                argv;

            console.log('using smartcomments@' + version + ' on node@' + process.versions.node);

            //console options
            argv = util.argvParse(process.argv.slice(2));

            if(argv){
                command = util.getCommand(argv, instance.commands);
                if(command){
                    command = util.getCommandOptions(argv, command);
                    if(instance[command.id]){
                        instance[command.id](command.options);
                    }

                } else{
                    //el comando no existe
                    console.log(' \n!!!Sorry, That command not exist\n');
                    instance.help();
                }
            } else{
                //no hay argumentos en la consola
                console.log(' \n!!!Sorry, Cannot find any arguments\n');
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

                    if(options.target.value){
                        current_dir = options.target.value; 
                    } else if (config.target_dir[0] !== '') {
                        current_dir = config.target_dir[0];
                    }

                    util.searchByFilter(current_dir, sc_options, files_list);

                    console.log('...We found ' + files_list.length + ' files...');
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
            var message = 'Command line options:\n\n' +
                ' -h, --help                Show this sttuf\n\n' +
                ' -g, --generate [options]  Generate comments\n\n'+
                '     [-t,--target]         Specifies the target from which to generate\n\n';

            console.log(message);
        },
        commands: [
            {
                id: 'generate',
                alias: {
                    '-g': 1,
                    '--generate': 1 
                },
                options: {
                    target: {
                        id: 'target',
                        alias: {
                            '-t': 1,
                            '--target': 1
                        }
                    },
                    config: {
                        id: 'config',
                        alias: {
                            '-c': 1,
                            '--config': 1
                        }
                    }
                }
            }
        ]


    } //end app

module.exports = {
    init: App.init
};
