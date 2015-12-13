using Microsoft.AspNet.Builder;
using Microsoft.AspNet.Http;
using Microsoft.AspNet.StaticFiles;
using Microsoft.Extensions.DependencyInjection;

namespace SignalrHost
{
    public class Startup
    {
        // This method gets called by the runtime. Use this method to add services to the container.
        // For more information on how to configure your application, visit http://go.microsoft.com/fwlink/?LinkID=398940
        public void ConfigureServices(IServiceCollection services)
        {
            services.AddSignalR();
        }

        // This method gets called by the runtime. Use this method to configure the HTTP request pipeline.
        public void Configure(IApplicationBuilder app)
        {
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

            app.UseWebSockets();
            
            app.UseSignalR()
                .UseSignalR<MyConnection>("/myconnection")
                .UseStaticFiles(opts)
                .UseIISPlatformHandler()
            .Run(async (context) =>
            {
                context.Response.StatusCode = 404;
                await context.Response.WriteAsync("Hello World!");
            });
        }

        // Entry point for the application.
        public static void Main(string[] args) => Microsoft.AspNet.Hosting.WebApplication.Run<Startup>(args);
    }
}
