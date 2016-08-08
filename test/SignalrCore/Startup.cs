using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace SignalrCore
{
    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit https://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSignalR(options =>
            {

                // only enable debug errors in Development
                options.Hubs.EnableDetailedErrors = true;
            });
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app, IHostingEnvironment env, ILoggerFactory loggerFactory)
        {
            loggerFactory.AddConsole();

            if (env.IsDevelopment())
            {
                app.UseDeveloperExceptionPage();
            }

            var fileProviderOptions = new FileExtensionContentTypeProvider();
            if (!fileProviderOptions.Mappings.ContainsKey(".ts"))
            {
                fileProviderOptions.Mappings.Add(".ts", "text/x.typescript");
            }

            var opts = new StaticFileOptions
            {
                ContentTypeProvider = fileProviderOptions,
                RequestPath = ""
            };

            //
            // SignalR
            app.UseWebSockets()
                .UseSignalR()
                .UseDefaultFiles()
                .UseStaticFiles(opts);


            app.Run(async (context) =>
            {
                context.Response.StatusCode = 404;
                await context.Response.WriteAsync("Hello World!");
            });
        }
    }
}
