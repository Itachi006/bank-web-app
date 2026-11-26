package com.bank;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class BankController {
    private final BankService bank;
    private final Map<String,Long> sessions=new ConcurrentHashMap<>();
    public BankController(BankService bank){this.bank=bank;}

    public record CreateRequest(String holderName,String pin,BigDecimal initialDeposit){}
    public record LoginRequest(Long accountId,String pin){}
    public record AmountRequest(BigDecimal amount){}
    public record TransferRequest(Long toAccountId,BigDecimal amount){}
    public record ApiError(String error){}

    @PostMapping("/accounts") public Map<String,Object> create(@RequestBody CreateRequest r){if(r==null)throw new BankException("Invalid request.");long id=bank.createAccount(r.holderName(),r.pin(),r.initialDeposit());return Map.of("accountId",id,"message","Account created successfully.");}
    @PostMapping("/login") public Map<String,Object> login(@RequestBody LoginRequest r){if(r==null||r.accountId()==null||r.accountId()<=0||!bank.authenticate(r.accountId(),r.pin()))throw new BankException("Invalid account number or PIN.");byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);sessions.put(token,r.accountId());return Map.of("token",token,"account",bank.account(r.accountId()));}
    @GetMapping("/me") public Map<String,Object> me(@RequestHeader(value="Authorization",required=false)String auth){return bank.account(requireSession(auth));}
    @PostMapping("/me/deposit") public Map<String,Object> deposit(@RequestHeader(value="Authorization",required=false)String auth,@RequestBody AmountRequest r){if(r==null)throw new BankException("Enter an amount.");bank.deposit(requireSession(auth),r.amount());return Map.of("message","Deposit successful.");}
    @PostMapping("/me/withdraw") public Map<String,Object> withdraw(@RequestHeader(value="Authorization",required=false)String auth,@RequestBody AmountRequest r){if(r==null)throw new BankException("Enter an amount.");bank.withdraw(requireSession(auth),r.amount());return Map.of("message","Withdrawal successful.");}
    @PostMapping("/me/transfer") public Map<String,Object> transfer(@RequestHeader(value="Authorization",required=false)String auth,@RequestBody TransferRequest r){if(r==null||r.toAccountId()==null)throw new BankException("Enter a destination account number.");bank.transfer(requireSession(auth),r.toAccountId(),r.amount());return Map.of("message","Transfer successful.");}
    @GetMapping("/me/transactions") public List<Map<String,Object>> history(@RequestHeader(value="Authorization",required=false)String auth){return bank.history(requireSession(auth));}
    @PostMapping("/logout") public Map<String,String> logout(@RequestHeader(value="Authorization",required=false)String auth){String token=token(auth);if(token!=null)sessions.remove(token);return Map.of("message","Logged out.");}
    private long requireSession(String auth){String t=token(auth);Long id=t==null?null:sessions.get(t);if(id==null)throw new UnauthorizedException();return id;}
    private String token(String auth){return auth!=null&&auth.startsWith("Bearer ")?auth.substring(7).trim():null;}
    @ExceptionHandler(BankException.class) public ResponseEntity<ApiError> bankError(BankException e){return ResponseEntity.badRequest().body(new ApiError(e.getMessage()));}
    @ExceptionHandler(UnauthorizedException.class) public ResponseEntity<ApiError> unauthorized(){return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new ApiError("Please log in to continue."));}
    @ExceptionHandler(Exception.class) public ResponseEntity<ApiError> unexpected(Exception e){return ResponseEntity.status(500).body(new ApiError("Something went wrong. Please try again."));}
    private static class UnauthorizedException extends RuntimeException{}
}
