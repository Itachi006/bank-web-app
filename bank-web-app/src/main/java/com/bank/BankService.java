package com.bank;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.*;
import java.util.*;
import javax.sql.DataSource;
import org.springframework.stereotype.Service;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@Service
public class BankService {
    private final DataSource dataSource;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    public BankService(DataSource dataSource) { this.dataSource = dataSource; }

    public long createAccount(String name, String pin, BigDecimal opening) {
        if (name == null || name.trim().length() < 2 || name.trim().length() > 100) throw new BankException("Enter a name between 2 and 100 characters.");
        validatePin(pin);
        BigDecimal amount = money(opening == null ? BigDecimal.ZERO : opening);
        if (amount.signum() < 0) throw new BankException("Initial deposit cannot be negative.");
        try (Connection c = dataSource.getConnection()) {
            c.setAutoCommit(false);
            try {
                long id;
                try (PreparedStatement ps = c.prepareStatement("INSERT INTO accounts(holder_name,pin_hash,balance) VALUES(?,?,?)", Statement.RETURN_GENERATED_KEYS)) {
                    ps.setString(1, name.trim()); ps.setString(2, encoder.encode(pin)); ps.setBigDecimal(3, amount); ps.executeUpdate();
                    try (ResultSet rs = ps.getGeneratedKeys()) { if (!rs.next()) throw new SQLException("Account number was not generated"); id = rs.getLong(1); }
                }
                if (amount.signum() > 0) insertTransaction(c, id, "OPENING_DEPOSIT", amount, "Initial deposit");
                c.commit(); return id;
            } catch (Exception e) { c.rollback(); throw e; }
        } catch (BankException e) { throw e; } catch (Exception e) { throw new BankException("Could not create account. Please try again."); }
    }

    public boolean authenticate(long id, String pin) {
        try (Connection c = dataSource.getConnection(); PreparedStatement ps = c.prepareStatement("SELECT pin_hash FROM accounts WHERE account_id=?")) {
            ps.setLong(1,id); try (ResultSet rs = ps.executeQuery()) { return rs.next() && encoder.matches(pin == null ? "" : pin, rs.getString(1)); }
        } catch (SQLException e) { throw new BankException("Login is temporarily unavailable."); }
    }

    public Map<String,Object> account(long id) {
        try (Connection c=dataSource.getConnection(); PreparedStatement ps=c.prepareStatement("SELECT account_id,holder_name,balance,created_at FROM accounts WHERE account_id=?")) {
            ps.setLong(1,id); try(ResultSet rs=ps.executeQuery()) { if(!rs.next()) throw new BankException("Account not found."); Map<String,Object> m=new LinkedHashMap<>(); m.put("accountId",rs.getLong("account_id")); m.put("holderName",rs.getString("holder_name")); m.put("balance",rs.getBigDecimal("balance")); m.put("createdAt",rs.getTimestamp("created_at")); return m; }
        } catch(SQLException e) { throw new BankException("Could not load account."); }
    }

    public void deposit(long id, BigDecimal raw) { BigDecimal amount=positive(raw); transactOne(id, amount, true, "DEPOSIT", "Cash deposit"); }
    public void withdraw(long id, BigDecimal raw) { BigDecimal amount=positive(raw); transactOne(id, amount, false, "WITHDRAWAL", "Cash withdrawal"); }

    private void transactOne(long id, BigDecimal amount, boolean deposit, String type, String description) {
        try(Connection c=dataSource.getConnection()) { c.setAutoCommit(false); try {
            BigDecimal balance=lockBalance(c,id); if(!deposit && balance.compareTo(amount)<0) throw new BankException("Insufficient funds.");
            BigDecimal next=deposit?balance.add(amount):balance.subtract(amount);
            try(PreparedStatement ps=c.prepareStatement("UPDATE accounts SET balance=? WHERE account_id=?")){ps.setBigDecimal(1,next);ps.setLong(2,id);ps.executeUpdate();}
            insertTransaction(c,id,type,amount,description); c.commit();
        } catch(Exception e){c.rollback(); if(e instanceof BankException b)throw b; throw e;} }
        catch(BankException e){throw e;} catch(Exception e){throw new BankException("Transaction failed. No money was moved.");}
    }

    public void transfer(long from, long to, BigDecimal raw) {
        BigDecimal amount=positive(raw); if(from==to) throw new BankException("Choose a different destination account.");
        try(Connection c=dataSource.getConnection()) { c.setAutoCommit(false); try {
            long first=Math.min(from,to), second=Math.max(from,to); BigDecimal firstBal=lockBalance(c,first), secondBal=lockBalance(c,second);
            BigDecimal source=from==first?firstBal:secondBal, target=to==first?firstBal:secondBal;
            if(source.compareTo(amount)<0) throw new BankException("Insufficient funds.");
            try(PreparedStatement ps=c.prepareStatement("UPDATE accounts SET balance=? WHERE account_id=?")){ps.setBigDecimal(1,source.subtract(amount));ps.setLong(2,from);ps.executeUpdate();ps.setBigDecimal(1,target.add(amount));ps.setLong(2,to);ps.executeUpdate();}
            insertTransaction(c,from,"TRANSFER_OUT",amount,"Transfer to account "+to); insertTransaction(c,to,"TRANSFER_IN",amount,"Transfer from account "+from); c.commit();
        } catch(Exception e){c.rollback();if(e instanceof BankException b)throw b;throw e;} }
        catch(BankException e){throw e;} catch(Exception e){throw new BankException("Transfer failed. No money was moved.");}
    }

    public List<Map<String,Object>> history(long id) {
        List<Map<String,Object>> out=new ArrayList<>();
        try(Connection c=dataSource.getConnection();PreparedStatement ps=c.prepareStatement("SELECT transaction_id,transaction_type,amount,description,created_at FROM transactions WHERE account_id=? ORDER BY created_at DESC, transaction_id DESC")){ps.setLong(1,id);try(ResultSet rs=ps.executeQuery()){while(rs.next()){Map<String,Object> m=new LinkedHashMap<>();m.put("transactionId",rs.getLong(1));m.put("type",rs.getString(2));m.put("amount",rs.getBigDecimal(3));m.put("description",rs.getString(4));m.put("createdAt",rs.getTimestamp(5));out.add(m);}}return out;}
        catch(SQLException e){throw new BankException("Could not load transaction history.");}
    }
    private BigDecimal lockBalance(Connection c,long id)throws SQLException { try(PreparedStatement ps=c.prepareStatement("SELECT balance FROM accounts WHERE account_id=? FOR UPDATE")){ps.setLong(1,id);try(ResultSet rs=ps.executeQuery()){if(!rs.next())throw new BankException("Account "+id+" not found.");return rs.getBigDecimal(1);}} }
    private void insertTransaction(Connection c,long id,String type,BigDecimal amount,String desc)throws SQLException {try(PreparedStatement ps=c.prepareStatement("INSERT INTO transactions(account_id,transaction_type,amount,description) VALUES(?,?,?,?)")){ps.setLong(1,id);ps.setString(2,type);ps.setBigDecimal(3,amount);ps.setString(4,desc);ps.executeUpdate();}}
    private BigDecimal positive(BigDecimal n){BigDecimal a=money(n);if(a.signum()<=0)throw new BankException("Amount must be greater than zero.");return a;}
    private BigDecimal money(BigDecimal n){if(n==null)throw new BankException("Enter a valid amount.");try{return n.setScale(2,RoundingMode.UNNECESSARY);}catch(ArithmeticException e){throw new BankException("Amounts can have at most 2 decimal places.");}}
    private void validatePin(String pin){if(pin==null||!pin.matches("\\d{4}"))throw new BankException("PIN must be exactly 4 digits.");}
}
