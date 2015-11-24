
using System.Threading.Tasks;
using Microsoft.AspNet.SignalR;

namespace SignalrHost
{

    public class MyHub : Hub
    {

        public Task<string> HelloServer(string name)
        {
            Clients.CallerState.myState = "even more yabber";
            return Task.FromResult($"Hello back { name }!");
        }



        public override Task OnConnected()
        {
            Clients.CallerState.blah = "yabber";
            Clients.Caller.helloClient("world", "!!!");

            return base.OnConnected();
        }
        
        public override Task OnDisconnected(bool stopCalled) {
            
            Clients.Others.somebodyDisconnected($"stopCalled: {stopCalled.ToString()} ");
            
            return base.OnDisconnected(stopCalled);
        }
    }
}