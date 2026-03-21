namespace Roster.Domain.Exceptions;
public class EventStoreUnavailableException : Exception
{
    public EventStoreUnavailableException(string message) : base(message) { }
    public EventStoreUnavailableException(string message, Exception inner) : base(message, inner) { }
}
