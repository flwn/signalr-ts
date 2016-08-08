var gulp = require('gulp')
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge2');
var dts = require('dts-bundle');
var rollup = require('rollup');
var runSequence = require('run-sequence');


var tsProject = ts.createProject('tsconfig.json', {
	sortOutput: true,
	typescript: require('typescript')
});

gulp.task('scripts', function () {
    var tsResult = gulp.src('src/*.ts')
		.pipe(sourcemaps.init()) // This means sourcemaps will be generated 
		.pipe(ts(tsProject));

    return merge([
		tsResult
			.dts.pipe(gulp.dest('dist/typings')),

        tsResult.js
			.pipe(concat('signalr-ts.js')) // You can use other plugins that also support gulp-sourcemaps 
			.pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file 
			.pipe(gulp.dest('dist'))
    ]);
});

gulp.task('compile', function () {
    var tsResult = gulp.src('src/*.ts')
        .pipe(ts(tsProject));

    return merge([
        tsResult.dts.pipe(gulp.dest('dist/es2015')),
        tsResult.js.pipe(gulp.dest('dist/es2015'))
    ]);
})

gulp.task('dts', function () {
	dts.bundle({
		name: 'signalr',
		main: './dist/es2015/index.d.ts',
		out: '../umd/signalr-ts.d.ts'
	});
});

gulp.task('rollup', function () {

	// used to track the cache for subsequent bundles

	return rollup.rollup({
		// The bundle's starting point. This file will be
		// included, along with the minimum necessary code
		// from its dependencies
		entry: 'dist/es2015/index.js'//,
		// If you have a bundle you want to re-use (e.g., when using a watcher to rebuild as files change),
		// you can tell rollup use a previous bundle as its starting point.
		// This is entirely optional!
//		cache: cache
	}).then(function (bundle) {


		// Cache our bundle for later use (optional)
		//cache = bundle;

		// Alternatively, let Rollup do it for you
		// (this returns a promise). This is much
		// easier if you're generating a sourcemap
		return bundle.write({
			format: 'umd',
			moduleName: 'signalr',
			dest: 'dist/umd/signalr-ts.js',
			external: ['fetch']
		});
	});
});

gulp.task('bundle-umd', function(done) {
	runSequence('compile', 'dts', 'rollup', done);
})

gulp.task('prepare-test', function () {
	return gulp.src('src/*.ts')
		.pipe(gulp.dest('test/SignalrHost/wwwroot/signalr-ts'));
});