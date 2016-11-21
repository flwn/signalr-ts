var gulp = require('gulp')
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge2');
var dts = require('dts-bundle');
var rollup = require('rollup');
var runSequence = require('run-sequence');



function createTsProject(opt) {
	var cfg = {
		sortOutput: true,
		typescript: require('typescript'),
		"module": opt.module
	};
	if(opt.outFile) {
		cfg.outFile = opt.outFile;	
	}
	return ts.createProject('tsconfig.json', cfg);
}




gulp.task('scripts', function () {
	var tsProject = createTsProject("none");
	var tsResult = gulp.src('src/*.ts')
		.pipe(sourcemaps.init()) // This means sourcemaps will be generated 
		.pipe(ts(tsProject));

	return merge([
		tsResult
			.dts.pipe(gulp.dest('dist/typings')),

		tsResult.js
			//.pipe(concat('signalr-ts.js')) // You can use other plugins that also support gulp-sourcemaps 
			.pipe(sourcemaps.write()) // Now the sourcemaps are added to the .js file 
			.pipe(gulp.dest('dist'))
	]);
});
gulp.task('compile-umd', function () {
	var tsProject = createTsProject({ module: "es2015" });

	var tsResult = gulp.src('src/*.ts')
		.pipe(ts(tsProject));

	return merge([
		tsResult.dts.pipe(gulp.dest('dist/es2015')),
		tsResult.js.pipe(gulp.dest('dist/es2015'))
	]);
});
gulp.task('compile-commonjs', function () {
	var tsProject = createTsProject({ module: "commonjs" });

	var tsResult = gulp.src('src/*.ts')
		.pipe(ts(tsProject));

	return merge([
		tsResult.dts.pipe(gulp.dest('dist/commonjs')),
		tsResult.js.pipe(gulp.dest('dist/commonjs'))
	]);
});

gulp.task('compile-system', function () {
	var tsProject = createTsProject({ module: "system",outFile: "dist/system/signalr-ts.js" });

	var tsResult = gulp.src('src/*.ts')
		.pipe(ts(tsProject));

	return merge([
		tsResult.dts.pipe(gulp.dest('dist/system')),
		tsResult.js.pipe(gulp.dest('dist/system'))
	]);
});



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

gulp.task('build-umd', function (done) {
	runSequence('compile-umd', 'dts', 'rollup', done);
})

gulp.task('prepare-test', function () {
	return gulp.src('src/*.ts')
		.pipe(gulp.dest('test/SignalrHost/wwwroot/signalr-ts'));
});