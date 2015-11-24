var gulp = require('gulp')
var ts = require('gulp-typescript');
var concat = require('gulp-concat');
var sourcemaps = require('gulp-sourcemaps');
var merge = require('merge2');

var tsProject = ts.createProject('tsconfig.json', {
	sortOutput: true
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

gulp.task('prepare-test', function() {
	return gulp.src('src/*.ts')
		.pipe(gulp.dest('test/SignalrHost/wwwroot/signalr-ts'));
});