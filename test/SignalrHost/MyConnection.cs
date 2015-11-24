using System.Threading.Tasks;
using Microsoft.AspNet.Http;
using Microsoft.AspNet.SignalR;

namespace SignalrHost {
    
	public class MyConnection : PersistentConnection
    {
        protected override Task OnReceived(HttpRequest request, string connectionId, string data)
        {
            return base.OnReceived(request, connectionId, data);
        }

        protected override async Task OnConnected(HttpRequest request, string connectionId)
        {
            await Connection.Send(connectionId, "Hello from PersistentConnection");
        }
    }
}